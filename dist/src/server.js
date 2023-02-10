"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./globals");
const Koa = require("koa");
const Router = require("@koa/router");
const bodyParser = require("koa-bodyparser");
const config_1 = require("./config");
const errors_1 = require("./errors");
const database_1 = require("./database");
const auth_1 = require("./auth");
// set up router
const router = new Router({ prefix: "/v1" });
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
app.use(bodyParser({ enableTypes: ["json"] }));
app.use(router.routes());
app.use(router.allowedMethods());
// Server close-down
const abortController = new AbortController();
function closeServer() {
  console.log("Closing server");
  abortController.abort();
}
function startServer() {
  console.log("Starting server");
  app.listen({
    port: config_1.config.APP_PORT,
    signal: abortController.signal,
  }, () => {
    console.log(`Server listening on port ${config_1.config.APP_PORT}`.yellow);
  });
}
async function main() {
  console.log("Calling startup routines".green);
  await (0, database_1.connect)(); // connect to database first
  await Promise.all([
    (0, auth_1.init)(),
  ]);
  console.log("Startup complete".green);
  startServer();
}
// App close-down
let closing = false;
async function onAppClose() {
  console.log("SIGINT received".cyan);
  if (!closing) {
    closing = true;
    console.log("Calling shutdown routines".green);
    await Promise.all([
      closeServer(),
      (0, database_1.close)(),
    ]);
    console.log("Shutdown complete".bgGreen);
  }
}
process.on("SIGINT", onAppClose);
main();
