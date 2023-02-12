"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./globals");
const koa_1 = require("./koa");
const bodyParser = require("koa-bodyparser");
const config_1 = require("./config");
const errors_1 = require("./errors");
const database_1 = require("./database");
const auth_1 = require("./auth");
const logger_1 = require("./logger");
// set up routers
const router = (0, koa_1.makeRouter)({ prefix: config_1.config.PATH_PREFIX });
router.use(require("./routers/health").router.routes());
router.use(require("./routers/apiKeys").router.routes());
// set up Koa server
const server = (0, koa_1.makeServer)();
// add function to context for generating full url
server.context.fullUrl = function (name, params) {
  (0, logger_1.log)("fullUrl", name, params);
  return config_1.config.APP_URL + router.url(name, params);
};
// middleware for error handling
server.use(async (ctx, next) => {
  try {
    (0, logger_1.log)("\n" + `${ctx.method} ${ctx.url}`.bgBlue);
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
    s += " " + `Sending ${ctx.response.length ?? 0} bytes`;
    (0, logger_1.log)(s);
    if (ctx.state.error) {
      (0, logger_1.log)(
        String(ctx.state.error.type).bgWhite + " " +
          ctx.state.error.message,
      );
    }
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
// do auth first
server.use(auth_1.authMiddleware);
// error if content-type is not application/json
server.use(async (ctx, next) => {
  const match = ctx.request.is("application/json");
  const hasContent = typeof ctx.request.length === "number" &&
    ctx.request.length > 0;
  if (hasContent && match !== "application/json") {
    (0, logger_1.log)(
      "Content-Type:",
      String(ctx.request.headers["content-type"]).blue,
    );
    throw new errors_1.ApiError(415, "Content-Type must be application/json");
  }
  await next();
});
// parse request body
server.use(bodyParser({
  enableTypes: ["json"],
  onerror: () => {
    throw new errors_1.ApiError(400, "Invalid JSON");
  },
}));
// add routes and allowed methods
server.use(router.routes());
server.use(router.allowedMethods());
// Server close-down
const abortController = new AbortController();
function closeServer() {
  (0, logger_1.log)("Closing server");
  abortController.abort();
}
function startServer() {
  (0, logger_1.log)("Starting server");
  server.listen({
    port: config_1.config.APP_PORT,
    signal: abortController.signal,
  }, () => {
    (0, logger_1.log)(
      `Server listening on port ${config_1.config.APP_PORT}`.yellow,
    );
  });
}
async function main() {
  (0, logger_1.log)("Calling startup routines".green);
  await (0, database_1.connect)(); // connect to database first
  await Promise.all([
    (0, auth_1.init)(),
  ]);
  (0, logger_1.log)("Startup complete".green);
  startServer();
}
// App close-down
let closing = false;
async function onAppClose() {
  (0, logger_1.log)("SIGINT received".cyan);
  if (!closing) {
    closing = true;
    (0, logger_1.log)("Calling shutdown routines".green);
    await Promise.all([
      closeServer(),
      (0, database_1.close)(),
    ]);
    (0, logger_1.log)("Shutdown complete".bgGreen);
  }
}
process.on("SIGINT", onAppClose);
main();
