import { randomUUID } from "node:crypto";
import TTLCache from "@isaacs/ttlcache";
import { create as createCDH } from "content-disposition-header";
import { Context } from "koa";
import _ from "lodash";
import { Document } from "mongodb";
import { ApiError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import { minutes } from "../../common/timeIntervals.js";
import { AuthKind } from "../auth.js";
import {
  LicenseKeyRecord,
  LicenseKeysQuery,
  ZLicenseKeyInfo,
  ZLicenseKeyUpdate,
  ZLicenseKeysQuery,
  createLicenseKey,
  generateLicenseFile,
  getProductConfig,
  hashEmail,
  listLicenseKeys,
  readLicenseKey,
  updateLicenseKey,
} from "../controllers/licenseKeysController.js";
import { makeIdentifierPattern } from "../identifiers.js";
import { AppContext, makeRouter } from "../koaWrapper.js";
import { generateEncryptedToken } from "../token.js";

export const router = makeRouter({ prefix: "/licenseKeys" });
const matchId = {
  pattern: makeIdentifierPattern("id", "lk"),
  uuid: randomUUID(),
};
const matchFile = {
  pattern: `${matchId.pattern}/file`,
  uuid: randomUUID(),
};

const cachedTokens = new TTLCache({
  max: 1000,
  ttl: minutes(60),
});
function generateToken(id: string, kind: AuthKind): string {
  // generate a URL to download the license key file, with an access token
  // that doesn't expire. token is cached so that the same token is returned
  // on subsequent requests. this is mainly to help testing.
  const cached = cachedTokens.get(id);
  if (typeof cached === "string") return cached;

  const resource = `licenseKeys/${id}`;
  const result = generateEncryptedToken({
    keyKind: kind,
    scopes: [`${resource}:read`],
    expires: undefined,
    resource: resource,
  });
  cachedTokens.set(id, result);
  return result;
}

// common routine to get full response body
async function getCommonBody(document: LicenseKeyRecord, ctx: AppContext) {
  const license = await generateLicenseFile(document, ctx.state.auth.kind);
  const token = generateToken(document._id, ctx.state.auth.kind);
  const url = ctx.getLocation(matchFile.uuid, { id: document._id }, { token });
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
    log(`Creating license key for ${config.productName}`);
  } catch (err) {
    throw new ApiError(400, `Invalid product '${data.product}'`);
  }

  const document = await createLicenseKey(data, ctx.state.auth);
  ctx.body = await getCommonBody(document, ctx);
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

async function list(query: LicenseKeysQuery, ctx: AppContext) {
  const documents = await listLicenseKeys(
    ZLicenseKeysQuery.parse(query),
    ctx.state.pagination,
    ctx.state.auth,
  );
  return await Promise.all(
    documents.map((document) => getCommonBody(document, ctx)),
  );
}
// list license keys
router.get("/", async (ctx) => {
  ctx.body = await list({}, ctx);
});
router.get("/byEmail/:email", async (ctx) => {
  const docs = await list({ emailHash: hashEmail(ctx.params.email) }, ctx);
  ctx.body = docs.filter((doc: Document) => doc.email === ctx.params.email);
});
router.get("/byFuzzyEmail/:email", async (ctx) => {
  ctx.body = await list({ emailHash: hashEmail(ctx.params.email) }, ctx);
});
router.get("/byOrigin/:origin", async (ctx) => {
  ctx.body = await list({ origin: ctx.params.origin }, ctx);
});
router.get("/byOrder/:order", async (ctx) => {
  ctx.body = await list({ order: ctx.params.order }, ctx);
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

  if (document.void) {
    throw new ApiError(404, "License key is void");
  }

  // generate license key file object
  const licenseFile = await generateLicenseFile(document, ctx.state.auth.kind);

  // if client accepts octet-stream, return the file as-is
  if (ctx.accepts("application/octet-stream")) {
    // decode the base64-encoded file
    ctx.body = licenseFile.plist;
    ctx.set("Content-Type", "application/octet-stream");
    ctx.set("Content-Disposition", createCDH(licenseFile.name));
  } else {
    throw new ApiError(406, "Client does not accept application/octet-stream");
  }
});

// Update a license key
router.patch(matchId.uuid, matchId.pattern, async (ctx) => {
  const data = ZLicenseKeyUpdate.strict().parse(ctx.request.body);
  if (await updateLicenseKey(ctx.params.id, data, ctx.state.auth)) {
    ctx.status = 204;
  }
});