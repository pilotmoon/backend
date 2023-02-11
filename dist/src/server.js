"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./globals");
const koa_1 = require("./koa");
const bodyParser = require("koa-bodyparser");
const config_1 = require("./config");
const errors_1 = require("./errors");
const database_1 = require("./database");
const auth_1 = require("./auth");
// set up routers
const router = (0, koa_1.makeRouter)({ prefix: config_1.config.PATH_PREFIX });
router.use(require("./routers/health").router.routes());
router.use(require("./routers/apiKeys").router.routes());
// set up Koa server
const server = (0, koa_1.makeServer)();
// add function to context for generating full url
server.context.fullUrl = function (name, params) {
  console.log("fullUrl", name, params);
  return config_1.config.APP_URL + router.url(name, params);
};
// middleware for all error handling
server.use(async (ctx, next) => {
  try {
    console.log(ctx.url.bgBlue);
    await next();
  } catch (error) {
    (0, errors_1.reportError)(error, ctx);
  } finally {
    let s = (0, errors_1.httpStatusString)(ctx.status);
    if (ctx.status >= 200 && ctx.status < 300) {
      s = s.bgGreen;
    } else if (ctx.status >= 400 && ctx.status < 500) {
      s = s.bgYellow;
    } else if (ctx.status >= 500 && ctx.status < 600) {
      s = s.white.bgRed;
    } else {
      s = s.bgWhite;
    }
    console.log(s);
  }
});
// modify all response bodies
server.use(async (ctx, next) => {
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
    ctx.body.livemode = ctx.state.auth.kind === "live";
  }
});
server.use(auth_1.authMiddleware);
server.use(bodyParser({ enableTypes: ["json"] }));
server.use(router.routes());
server.use(router.allowedMethods());
// Server close-down
const abortController = new AbortController();
function closeServer() {
  console.log("Closing server");
  abortController.abort();
}
function startServer() {
  console.log("Starting server");
  server.listen({
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
