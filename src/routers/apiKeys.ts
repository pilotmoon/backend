import {
  createApiKey,
  deleteApiKey,
  PartialAuthContext,
  readApiKey,
  SettableAuthContext,
  updateApiKey,
} from "../auth";
import { makeRouter } from "../koa";
import { ApiError } from "../errors";
import { randomUUID } from "node:crypto";

export const router = makeRouter({ prefix: "/api_keys" });
const PATH_NAME = randomUUID();

function sanitizeApiKey(document: any) {
  delete document.key;
  return document;
}

router.post("/", async (ctx) => {
  const params = SettableAuthContext.parse(ctx.request.body);
  const document = await createApiKey(params, ctx.state.auth);
  ctx.body = document;
  ctx.status = 201;
  ctx.set("Location", ctx.fullUrl(PATH_NAME, { id: document._id }));
});

router.get(PATH_NAME, "/:id", async (ctx) => {
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
  ctx.body = sanitizeApiKey(document);
});

router.patch("/:id", async (ctx) => {
  let id;
  if (ctx.params.id === "current") {
    id = ctx.state.apiKeyId;
  } else {
    id = ctx.params.id;
  }
  const params = PartialAuthContext.parse(ctx.request.body);
  const document = await updateApiKey(id, params, ctx.state.auth);
  if (!document) {
    throw new ApiError(404, `API key '${id}' not found`);
  }
  ctx.body = sanitizeApiKey(document);
});

// delete api key
router.delete("/:id", async (ctx) => {
  if (ctx.params.id === "current") {
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
