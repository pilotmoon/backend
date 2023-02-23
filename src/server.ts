import "./globals";
import { makeRouter, makeServer } from "./koa";
import bodyParser = require("koa-bodyparser");
import { config } from "./config";
import { ApiError, httpStatusString, reportError } from "./errors";
import { close as closeDb, connect as connectDb } from "./database";
import { authMiddleware, init as initAuth } from "./controllers/authController";
import { init as initProducts } from "./routers/products";
import { log } from "./logger";
import { asciiHello } from "./static";
import { intersection, union } from "lodash";
import { paginator } from "./paginate";

// set up main router
const mainRouter = makeRouter();
mainRouter.use(require("./routers/health").router.routes());
mainRouter.use(require("./routers/apiKeys").router.routes());
mainRouter.use(require("./routers/products").router.routes());

// set up Koa server
const server = makeServer();

// add function to context for generating url for Location header
server.context.location = function (name: string, params?: any) {
  log("location", name, params);
  return mainRouter.url(name, params);
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
        ctx.state.error.stack ? "\n" + ctx.state.error.stack : "",
      );
    }
  }
});

// modify all response bodies
server.use(async (ctx, next) => {
  await next();
  if (typeof ctx.body === "object") {
    // if array
    function replace(obj: any) {
      if (obj._id) {
        if (typeof obj._id === "string") {
          obj.id = obj._id;
        }
        delete obj._id;
      }
      return obj;
    }
    if (Array.isArray(ctx.body)) {
      ctx.body = {
        object: "list",
        paginate: ctx.state.paginate,
        items: ctx.body.map(replace),
      };
    } else {
      ctx.body = replace(ctx.body);
    }
    // set livemode key
    ctx.body.livemode = ctx.state.auth.kind === "live";
  }
});

// access allowlist
server.use(async (ctx, next) => {
  const ips = union(ctx.request.ips, [ctx.request.ip]);
  const allow = config.ACCESS_ALLOWLIST;
  log("IPs:", ips, "Allow:", allow);
  if (allow.length > 0 && intersection(ips, allow).length == 0) {
    throw new ApiError(403, "Access denied");
  }
  await next();
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
server.use(paginator());
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

// Server startup and shutdown
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
    log(`Server listening on port ${config.APP_PORT}`.bgMagenta);
  });
}

// App close-down
let closing = false;
process.on("SIGINT", async () => {
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
});

// App startup
(async () => {
  log("Calling startup routines".green);
  await connectDb(); // connect to database first
  await Promise.all([ // run all other startup routines in parallel
    initAuth(),
    initProducts(),
  ]);
  log("Startup complete".green);
  startServer();
})();
