import { makeRouter } from "../koaWrapper";
import { randomUUID } from "node:crypto";
import { makeIdentifierPattern } from "../identifiers";
import {
  createLicenseKey,
  readLicenseKey,
  ZLicenseKeyInfo,
} from "../controllers/licenseKeysController";
import { log } from "../logger";

export const router = makeRouter({ prefix: "/licenseKeys" });
const matchId = {
  pattern: makeIdentifierPattern("id", "lk"),
  uuid: randomUUID(),
};

// Create a new license key
router.post("/", async (ctx) => {
  const suppliedData = ZLicenseKeyInfo.strict().parse(ctx.request.body);
  const document = await createLicenseKey(suppliedData, ctx.state.auth);
  ctx.body = document;
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

// Get a license key by id
router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  log("GET /licenseKeys/:id", ctx.params.id);
  const document = await readLicenseKey(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = document;
  }
});
