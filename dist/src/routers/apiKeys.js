"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const auth_1 = require("../auth");
const koa_1 = require("../koa");
const errors_1 = require("../errors");
const node_crypto_1 = require("node:crypto");
exports.router = (0, koa_1.makeRouter)({ prefix: "/api_keys" });
const PATH_NAME = (0, node_crypto_1.randomUUID)();
function sanitizeApiKey(document) {
  delete document.key;
  return document;
}
exports.router.post("/", async (ctx) => {
  const params = auth_1.SettableAuthContext.parse(ctx.request.body);
  const document = await (0, auth_1.createApiKey)(params, ctx.state.auth);
  ctx.body = document; // key only shown on creation
  ctx.status = 201;
  ctx.set("Location", ctx.fullUrl(PATH_NAME, { id: document._id }));
});
// get current api key
exports.router.get("/current", async (ctx) => {
  const document = await (0, auth_1.readApiKey)(
    ctx.state.apiKeyId,
    ctx.state.auth,
  );
  if (!document) {
    throw new errors_1.ApiError(404, "Record not found");
  }
  ctx.body = sanitizeApiKey(document);
});
exports.router.get(PATH_NAME, "/:id", async (ctx) => {
  const id = ctx.params.id;
  const document = await (0, auth_1.readApiKey)(id, ctx.state.auth);
  if (!document) {
    throw new errors_1.ApiError(404, "Record not found");
  }
  ctx.body = sanitizeApiKey(document);
});
exports.router.patch("/:id", async (ctx) => {
  const id = ctx.params.id;
  const params = auth_1.PartialAuthContext.parse(ctx.request.body);
  const document = await (0, auth_1.updateApiKey)(id, params, ctx.state.auth);
  if (!document) {
    throw new errors_1.ApiError(404, "Record not found");
  }
  ctx.body = sanitizeApiKey(document);
});
// delete api key
exports.router.delete("/:id", async (ctx) => {
  const id = ctx.params.id;
  const result = await (0, auth_1.deleteApiKey)(id, ctx.state.auth);
  if (!result) {
    throw new errors_1.ApiError(404, "Record not found");
  } else {
    ctx.status = 204;
  }
});
