import { randomUUID } from "node:crypto";
import _ from "lodash";
import { ApiError } from "../errors.js";
import {
  ZApiKeyInfo,
  ZApiKeyInfoUpdate,
  createApiKey,
  deleteApiKey,
  listApiKeys,
  readApiKey,
  updateApiKey,
} from "../controllers/apiKeysController.js";
import { makeIdentifierPattern } from "../identifiers.js";
import { makeRouter } from "../koaWrapper.js";

export const router = makeRouter({ prefix: "/apiKeys" });
const matchId = {
  pattern: makeIdentifierPattern("id", "ak"),
  uuid: randomUUID(),
};
const matchIdAndCurrent = makeIdentifierPattern("id", "ak", ["current"]);

function sanitize(document: Record<string, unknown>) {
  return _.omit(document, "hashedKey");
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
  const documents = await listApiKeys(ctx.state.pagination, ctx.state.auth);
  ctx.body = documents.map(sanitize);
});

router.get(matchIdAndCurrent, async (ctx) => {
  const id = ctx.params.id === "current" ? ctx.state.apiKeyId : ctx.params.id;
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
