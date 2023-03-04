import { makeRouter } from "../koaWrapper";
import { randomUUID } from "node:crypto";
import { AuthKind, makeIdentifierPattern } from "../identifiers";
import {
  createLicenseKey,
  readLicenseKey,
  ZLicenseKeyInfo,
} from "../controllers/licenseKeysController";
import { generateEncryptedToken } from "../token";
import { log } from "../logger";
import TTLCache = require("@isaacs/ttlcache");

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

// Create a new license key
router.post("/", async (ctx) => {
  const suppliedData = ZLicenseKeyInfo.strict().parse(ctx.request.body);
  const document = await createLicenseKey(suppliedData, ctx.state.auth);
  ctx.body = {
    ...document,
    downloadUrl: ctx.getLocation(matchFile.uuid, { id: document._id }, {
      token: generateToken(document._id, ctx.state.auth.kind),
    }, true),
  };
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

// Get a license key by id
router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readLicenseKey(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = {
      ...document,
      downloadUrl: ctx.getLocation(matchFile.uuid, { id: document._id }, {
        token: generateToken(document._id, ctx.state.auth.kind),
      }, true),
    };
  }
});

// Get a license key file by id
router.get(matchFile.uuid, matchFile.pattern, async (ctx) => {
  // todo
});
