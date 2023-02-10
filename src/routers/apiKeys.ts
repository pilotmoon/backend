import Router = require("@koa/router");
import { randomUUID } from "crypto";
import {
  createApiKey,
  deleteApiKey,
  PartialAuthContext,
  readApiKey,
  SettableAuthContext,
  updateApiKey,
} from "../auth";
import { ApiError } from "../errors";

export const router = new Router({ prefix: "/api_keys" });
const PATH_NAME = randomUUID();

function sanitizeApiKey(document: any) {
  delete document.key;
  return document;
}

router.post("/", async (ctx) => {
  const params = SettableAuthContext.parse(ctx.request.body);
  const document = await createApiKey(params, ctx.state.auth);
  ctx.body = document; // key only shown on creation
  ctx.status = 201;
  ctx.set("Location", ctx.fullUrl(PATH_NAME, { id: document._id }));
});

// get current api key
router.get("/current", async (ctx) => {
  const document = await readApiKey(ctx.state.apiKeyId, ctx.state.auth);
  if (!document) {
    throw new ApiError(404, "Record not found");
  }
  ctx.body = sanitizeApiKey(document);
});

router.get(PATH_NAME, "/:id", async (ctx) => {
  const id = ctx.params.id;
  const document = await readApiKey(id, ctx.state.auth);
  if (!document) {
    throw new ApiError(404, "Record not found");
  }
  ctx.body = sanitizeApiKey(document);
});

router.patch("/:id", async (ctx) => {
  const id = ctx.params.id;
  const params = PartialAuthContext.parse(ctx.request.body);
  const document = await updateApiKey(id, params, ctx.state.auth);
  if (!document) {
    throw new ApiError(404, "Record not found");
  }
  ctx.body = sanitizeApiKey(document);
});

// delete api key
router.delete("/:id", async (ctx) => {
  const id = ctx.params.id;
  const result = await deleteApiKey(id, ctx.state.auth);
  if (!result) {
    throw new ApiError(404, "Record not found");
  } else {
    ctx.status = 204;
  }
});
