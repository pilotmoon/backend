import { makeRouter } from "../koaWrapper.js";
import { randomUUID } from "node:crypto";
import { AuthKind } from "../auth.js";
import { makeIdentifierPattern } from "../identifiers.js";
import {
  createLicenseKey,
  generateLicenseFile,
  getProductConfig,
  LicenseKeyRecord,
  readLicenseKey,
  ZLicenseKeyInfo,
} from "../controllers/licenseKeysController.js";
import { generateEncryptedToken } from "../token.js";
import { log } from "../../logger.js";
import TTLCache from "@isaacs/ttlcache";
import _ from "lodash";
import { Context } from "koa";
import { ApiError } from "../../errors.js";
import { create as createCDH } from "content-disposition-header";

export const router = makeRouter({ prefix: "/licenseKeys" });
const matchId = {
  pattern: makeIdentifierPattern("id", "lk"),
  uuid: randomUUID(),
};
const matchFile = {
  pattern: matchId.pattern + "/file",
  uuid: randomUUID(),
};

const cachedTokens = new TTLCache({
  max: 1000,
  ttl: 60 * 60 * 1000, // 1 hour
});
function generateToken(id: string, kind: AuthKind) {
  // generate a URL to download the license key file, with an access token
  // that doesn't expire. token is cached so that the same token is returned
  // on subsequent requests. this is mainly to help testing.
  const cached = cachedTokens.get(id);
  if (cached) return cached;

  const resource = `licenseKeys/${id}`;
  const result = generateEncryptedToken({
    keyKind: kind,
    scopes: [resource + ":read"],
    expires: undefined,
    resource: resource,
  });
  cachedTokens.set(id, result);
  return result;
}

// common routine to get full response body
async function getCommonBody(document: LicenseKeyRecord, ctx: Context) {
  const license = await generateLicenseFile(document, ctx.state.auth.kind);
  const url = ctx.getLocation(matchFile.uuid, { id: document._id }, {
    token: generateToken(document._id, ctx.state.auth.kind),
  }, true);
  return {
    ..._.omit(document, "emailHash"),
    file: { ..._.omit(license, "plist"), url },
  };
}

// Create a new license key
router.post("/", async (ctx) => {
  const data = ZLicenseKeyInfo.strict().parse(ctx.request.body);

  // check that the product id is valid
  try {
    const config = await getProductConfig(data.product, ctx.state.auth.kind);
    log("Creating license key for " + config.productName);
  } catch (err) {
    throw new ApiError(400, `Invalid product '${data.product}'`);
  }

  const document = await createLicenseKey(data, ctx.state.auth);
  ctx.body = await getCommonBody(document, ctx);
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

// Get a license key by id
router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readLicenseKey(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = await getCommonBody(document, ctx);
  }
});

// Get a license key file by id
router.get(matchFile.uuid, matchFile.pattern, async (ctx) => {
  const document = await readLicenseKey(ctx.params.id, ctx.state.auth);
  if (!document) return;

  // generate license key file object
  const licenseFile = await generateLicenseFile(
    document,
    ctx.state.auth.kind,
  );

  // if client accepts octet-stream, return the file as-is
  if (ctx.accepts("application/octet-stream")) {
    // decode the base64-encoded file
    ctx.body = licenseFile.plist;
    ctx.set("Content-Type", "application/octet-stream");
    ctx.set(
      "Content-Disposition",
      createCDH(licenseFile.name),
    );
  } else {
    throw new ApiError(
      406,
      "Client does not accept application/octet-stream",
    );
  }
});
