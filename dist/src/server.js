"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Koa = require("koa");
const Router = require("@koa/router");
const bodyParser = require("koa-bodyparser");
const config_1 = require("./config");
const errors_1 = require("./errors");
const database_1 = require("./database");
require("colors");
// set up router
const router = new Router();
// healthcheck endpoint
router.get("/healthcheck", async (ctx, next) => {
  ctx.body = { "healthcheck": true };
  await next();
});
// add sub-routers
router.use(require("./routers/apiKeys").router.routes());
// set up Koa app
const app = new Koa();
// standard error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    (0, errors_1.reportError)(error, ctx);
  }
});
// replace _id with id for string ids
app.use(async (ctx, next) => {
  await next();
  if (ctx.body && ctx.body._id) {
    if (typeof ctx.body._id === "string") {
      ctx.body.id = ctx.body._id;
    }
    delete ctx.body._id;
  }
});
// require API key for all routes
app.use(async (ctx, next) => {
  const apiKey = ctx.request.headers["x-api-key"];
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    throw new errors_1.ApiError(401, "API key is required");
  }
  await next();
});
// remove version prefix from all routes
app.use(async (ctx, next) => {
  ctx.url = ctx.url.replace("/v1", "");
  await next();
});
app.use(bodyParser({ enableTypes: ["json"] }));
app.use(router.routes());
app.use(router.allowedMethods());
async function main() {
  await (0, database_1.connect)();
  app.listen(
    config_1.APP_PORT,
    () => console.log(`Server listening on port ${config_1.APP_PORT}`.yellow),
  );
}
main();
