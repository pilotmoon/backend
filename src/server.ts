import "./globals";
import { makeRouter, makeServer } from "./koa";
import bodyParser = require("koa-bodyparser");
import { config } from "./config";
import { ApiError, httpStatusString, reportError } from "./errors";
import { close as closeDb, connect as connectDb } from "./database";
import { authMiddleware, init as initAuth } from "./auth";
import { log } from "./logger";
import { asciiHello } from "./static";

// set up main router
const mainRouter = makeRouter();
mainRouter.use(require("./routers/health").router.routes());
mainRouter.use(require("./routers/apiKeys").router.routes());

// set up Koa server
const server = makeServer();

// add function to context for generating full url
server.context.fullUrl = function (name: string, params?: any) {
  log("fullUrl", name, params);
  return config.APP_URL + mainRouter.url(name, params);
};

// middleware for error handling
server.use(async (ctx, next) => {
  try {
    log("\n" + `${ctx.method} ${ctx.url}`.bgBlue);
    await next();
  } catch (error) {
    reportError(error, ctx);
  } finally {
    let s = httpStatusString(ctx.status);
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
    log(s);
    if (ctx.state.error) {
      log(
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

// root GET is allowed without auth
const rootRouter = makeRouter();
rootRouter.get("/", (ctx) => {
  ctx.body = asciiHello();
});
server.use(rootRouter.routes());
server.use(rootRouter.allowedMethods());
// then do auth
server.use(authMiddleware);
// error if content-type is not application/json
server.use(async (ctx, next) => {
  const match = ctx.request.is("application/json");
  const hasContent = typeof ctx.request.length === "number" &&
    ctx.request.length > 0;
  if (hasContent && match !== "application/json") {
    log(
      "Content-Type:",
      String(ctx.request.headers["content-type"]).blue,
    );
    throw new ApiError(415, "Content-Type must be application/json");
  }
  await next();
});
// parse request body
server.use(bodyParser({
  enableTypes: ["json"],
  onerror: () => {
    throw new ApiError(400, "Invalid JSON");
  },
}));
// add routes and allowed methods
server.use(mainRouter.routes());
server.use(mainRouter.allowedMethods());

// Server close-down
const abortController = new AbortController();
function closeServer() {
  log("Closing server");
  abortController.abort();
}
function startServer() {
  log("Starting server");
  server.listen({
    port: config.APP_PORT,
    signal: abortController.signal,
  }, () => {
    log(`Server listening on port ${config.APP_PORT}`.green);
  });
}

async function main() {
  log("Calling startup routines".green);
  await connectDb(); // connect to database first
  await Promise.all([ // run all other startup routines in parallel
    initAuth(),
  ]);
  log("Startup complete".green);
  startServer();
}

// App close-down
let closing = false;
async function onAppClose() {
  log("SIGINT received".cyan);
  if (!closing) {
    closing = true;
    log("Calling shutdown routines".green);
    await Promise.all([ // run all shutdown routines in parallel
      closeServer(),
      closeDb(),
    ]);
    log("Shutdown complete".bgGreen);
  }
}
process.on("SIGINT", onAppClose);
main();
