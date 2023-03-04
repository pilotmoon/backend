import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  readApiKey,
  updateApiKey,
  ZApiKeyInfo,
  ZApiKeyInfoUpdate,
} from "../controllers/authController";
import { makeRouter } from "../koaWrapper";
import { ApiError } from "../errors";
import { randomUUID } from "node:crypto";
import { makeIdentifierPattern } from "../identifiers";
import { omit } from "../omit";

export const router = makeRouter({ prefix: "/apiKeys" });
const matchId = {
  pattern: makeIdentifierPattern("id", "ak"),
  uuid: randomUUID(),
};
const matchIdAndCurrent = makeIdentifierPattern("id", "ak", ["current"]);

function sanitize(document: Record<string, unknown>) {
  return omit(document, "hashedKey");
}

router.post("/", async (ctx) => {
  const params = ZApiKeyInfo.strict().parse(ctx.request.body);
  const document = await createApiKey(params, ctx.state.auth);
  ctx.body = sanitize(document);
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

// list api keys
router.get("/", async (ctx) => {
  const documents = await listApiKeys(ctx.state.paginate, ctx.state.auth);
  ctx.body = documents.map(sanitize);
});

router.get(matchIdAndCurrent, async (ctx) => {
  const id = (ctx.params.id === "current") ? ctx.state.apiKeyId : ctx.params.id;
  const document = await readApiKey(id, ctx.state.auth);
  if (document) {
    ctx.body = sanitize(document);
  }
});

router.patch(matchId.uuid, matchId.pattern, async (ctx) => {
  if (ctx.params.id === ctx.state.apiKeyId) {
    throw new ApiError(400, "Cannot modify current API key");
  }
  const params = ZApiKeyInfoUpdate.strict().parse(ctx.request.body);
  if (await updateApiKey(ctx.params.id, params, ctx.state.auth)) {
    ctx.status = 204;
  }
});

// delete api key
router.delete(matchId.pattern, async (ctx) => {
  if (ctx.params.id === ctx.state.apiKeyId) {
    throw new ApiError(400, "Cannot delete current API key");
  }
  if (await deleteApiKey(ctx.params.id, ctx.state.auth)) {
    ctx.status = 204;
  }
});
