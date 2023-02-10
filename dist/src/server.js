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
const router = new Router({ prefix: config_1.config.PATH_PREFIX });
// healthcheck endpoint
router.get("/healthcheck", async (ctx, next) => {
  ctx.body = { "healthcheck": true };
  await next();
});
// add sub-routers
router.use(require("./routers/apiKeys").router.routes());
// set up Koa app
const app = new Koa();
// add function to context for generating full url
app.context.fullUrl = function (name, params) {
  console.log("fullUrl", name, params);
  return config_1.config.APP_URL + router.url(name, params);
};
// middleware for all error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    (0, errors_1.reportError)(error, ctx);
  }
});
// modify all response bodies
app.use(async (ctx, next) => {
  await next();
  if (typeof ctx.body === "object") {
    // replace _id with id
    if (ctx.body._id) {
      if (typeof ctx.body._id === "string") {
        ctx.body.id = ctx.body._id;
      }
      delete ctx.body._id;
    }
    // set livemode key
    ctx.body.livemode = ctx.state?.auth?.kind === "live";
  }
});
app.use(auth_1.authMiddleware);
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
