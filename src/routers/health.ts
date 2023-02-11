import { verifyScope } from "../auth";
import Router = require("@koa/router");

export const router = new Router();

// health check endpoint
router.get("/health", async (ctx, next) => {
  await verifyScope("health:read", ctx.state.auth);
  ctx.body = { "object": "health" };
  await next();
});
