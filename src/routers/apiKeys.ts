import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  PartialAuthContext,
  readApiKey,
  SettableAuthContext,
  updateApiKey,
} from "../authController";
import { makeRouter } from "../koa";
import { ApiError } from "../errors";
import { randomUUID } from "node:crypto";
import { makeIdentifierPattern } from "../identifiers";

export const router = makeRouter({ prefix: "/apiKeys" });
const matchId = {
  pattern: makeIdentifierPattern("id", "ak"),
};
const matchIdAndCurrent = {
  pattern: makeIdentifierPattern("id", "ak", ["current"]),
  uuid: randomUUID(),
};

function excludeKey(obj: Record<string, unknown>, key: string) {
  const { [key]: removed, ...rest } = obj;
  return rest;
}
function sanitize(document: Record<string, unknown>) {
  return excludeKey(document, "hashedKey");
}

router.post("/", async (ctx) => {
  const params = SettableAuthContext.parse(ctx.request.body);
  const document = await createApiKey(params, ctx.state.auth);
  ctx.body = sanitize(document);
  ctx.status = 201;
  ctx.set(
    "Location",
    ctx.location(matchIdAndCurrent.uuid, { id: document._id }),
  );
});

// list api keys
router.get("/", async (ctx) => {
  const documents = await listApiKeys(ctx.state.auth, ctx.state.paginate);
  ctx.body = documents.map(sanitize);
});

router.get(matchIdAndCurrent.uuid, matchIdAndCurrent.pattern, async (ctx) => {
  let id;
  if (ctx.params.id === "current") {
    id = ctx.state.apiKeyId;
  } else {
    id = ctx.params.id;
  }
  const document = await readApiKey(id, ctx.state.auth);
  if (!document) {
    throw new ApiError(404, `API key '${id}' not found`);
  }
  ctx.body = sanitize(document);
});

router.patch(matchId.pattern, async (ctx) => {
  if (ctx.params.id === ctx.state.apiKeyId) {
    throw new ApiError(400, "Cannot modify current API key");
  }
  const id = ctx.params.id;
  const params = PartialAuthContext.parse(ctx.request.body);
  const document = await updateApiKey(id, params, ctx.state.auth);
  if (document === false) {
    throw new ApiError(404, `API key '${id}' not found`);
  } else if (document !== null) {
    ctx.body = sanitize(document);
  } else {
    ctx.status = 204; // no content
  }
});

// delete api key
router.delete(matchId.pattern, async (ctx) => {
  if (ctx.params.id === ctx.state.apiKeyId) {
    throw new ApiError(400, "Cannot delete current API key");
  }
  const id = ctx.params.id;
  const result = await deleteApiKey(id, ctx.state.auth);
  if (!result) {
    throw new ApiError(404, `API key '${id}' not found`);
  } else {
    ctx.status = 204;
  }
});
