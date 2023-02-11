"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const auth_1 = require("../auth");
const koa_1 = require("../koa");
const errors_1 = require("../errors");
const node_crypto_1 = require("node:crypto");
exports.router = (0, koa_1.makeRouter)({ prefix: "/api_keys" });
const matchId = {
  pattern: `/:id(ak_[0-9a-zA-Z]{24})`,
};
const matchIdAndCurrent = {
  pattern: `/:id(ak_[0-9a-zA-Z]{24}|current)`,
  uuid: (0, node_crypto_1.randomUUID)(),
};
function sanitizeApiKey(document) {
  delete document.key;
  return document;
}
exports.router.post("/", async (ctx) => {
  const params = auth_1.SettableAuthContext.parse(ctx.request.body);
  const document = await (0, auth_1.createApiKey)(params, ctx.state.auth);
  ctx.body = document;
  ctx.status = 201;
  ctx.set(
    "Location",
    ctx.fullUrl(matchIdAndCurrent.uuid, { id: document._id }),
  );
});
exports.router.get(
  matchIdAndCurrent.uuid,
  matchIdAndCurrent.pattern,
  async (ctx) => {
    let id;
    if (ctx.params.id === "current") {
      id = ctx.state.apiKeyId;
    } else {
      id = ctx.params.id;
    }
    const document = await (0, auth_1.readApiKey)(id, ctx.state.auth);
    if (!document) {
      throw new errors_1.ApiError(404, `API key '${id}' not found`);
    }
    ctx.body = sanitizeApiKey(document);
  },
);
exports.router.patch(matchId.pattern, async (ctx) => {
  if (ctx.params.id === ctx.state.apiKeyId) {
    throw new errors_1.ApiError(400, "Cannot modify current API key");
  }
  const id = ctx.params.id;
  const params = auth_1.PartialAuthContext.parse(ctx.request.body);
  const document = await (0, auth_1.updateApiKey)(id, params, ctx.state.auth);
  if (!document) {
    throw new errors_1.ApiError(404, `API key '${id}' not found`);
  }
  ctx.body = sanitizeApiKey(document);
});
// delete api key
exports.router.delete(matchId.pattern, async (ctx) => {
  if (ctx.params.id === ctx.state.apiKeyId) {
    throw new errors_1.ApiError(400, "Cannot delete current API key");
  }
  const id = ctx.params.id;
  const result = await (0, auth_1.deleteApiKey)(id, ctx.state.auth);
  if (!result) {
    throw new errors_1.ApiError(404, `API key '${id}' not found`);
  } else {
    ctx.status = 204;
  }
});
