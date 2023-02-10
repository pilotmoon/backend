"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const Router = require("@koa/router");
const crypto_1 = require("crypto");
const auth_1 = require("../auth");
const errors_1 = require("../errors");
exports.router = new Router({ prefix: "/api_keys" });
const PATH_NAME = (0, crypto_1.randomUUID)();
exports.router.post("/", async (ctx, next) => {
  const params = auth_1.AuthContext.parse(ctx.request.body);
  const document = await (0, auth_1.createApiKey)(params, ctx.state.auth);
  ctx.body = document;
  ctx.status = 201;
  ctx.set("Location", ctx.fullUrl(PATH_NAME, { id: document._id }));
});
exports.router.get(PATH_NAME, "/:id", async (ctx, next) => {
  const id = ctx.params.id;
  const document = await (0, auth_1.readApiKey)(id, ctx.state.auth);
  if (!document) {
    throw new errors_1.ApiError(404, "API key not found");
  }
  ctx.body = document;
});
