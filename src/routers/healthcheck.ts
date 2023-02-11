import { verifyScope } from "../auth";
import Router = require("@koa/router");

export const router = new Router();

// health check endpoint
router.get("/healthcheck", async (ctx, next) => {
  await verifyScope("healthcheck:read", ctx.state.auth);
  ctx.body = { "healthcheck": true };
  await next();
});
