import { makeRouter } from "../koaWrapper";
import { randomUUID } from "node:crypto";
import { AuthKind } from "../auth";
import { makeIdentifierPattern } from "../identifiers";
import {
  createLicenseKey,
  generateLicenseFile,
  readLicenseKey,
  ZLicenseKeyInfo,
} from "../controllers/licenseKeysController";
import { generateEncryptedToken } from "../token";
import { log } from "../logger";
import TTLCache = require("@isaacs/ttlcache");
import { z } from "zod";

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

// schema for the json wrapper for the license key file
export const ZLicenseKeyFile = z.object({
  // literal string "licenseKeyFile"
  object: z.literal("licenseKeyFile"),
  // license key file content, as a Base64-encoded string
  data: z.string(),
  // license key filename, e.g. "John_Doe.popcliplicense"
  filename: z.string(),
});
export type LicenseKeyFile = z.infer<typeof ZLicenseKeyFile>;

// Get a license key file by id
router.get(matchFile.uuid, matchFile.pattern, async (ctx) => {
  const document = await readLicenseKey(ctx.params.id, ctx.state.auth);
  if (document) {
    const licenseFile = await generateLicenseFile(document, ctx.state.auth);
    // if client accepts octet-stream, return the file as-is
    if (ctx.accepts("application/octet-stream")) {
      // decode the base64-encoded file
      ctx.body = licenseFile.plist;
      ctx.set("Content-Type", "application/octet-stream");
      ctx.set(
        "Content-Disposition",
        `attachment; filename="${licenseFile.filename}"`,
      );
    } else {
      // otherwise, return the license file object
      ctx.body = ZLicenseKeyFile.parse({
        object: "licenseKeyFile",
        data: Buffer.from(licenseFile.plist).toString("base64"),
        filename: licenseFile.filename,
      });
    }
  }
});
