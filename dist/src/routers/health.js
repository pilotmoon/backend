"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const auth_1 = require("../auth");
const Router = require("@koa/router");
exports.router = new Router();
// health check endpoint
exports.router.get("/health", async (ctx, next) => {
  await (0, auth_1.verifyScope)("health:read", ctx.state.auth);
  ctx.body = { "object": "health" };
  await next();
});
