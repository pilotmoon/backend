import "./globals";
import Koa = require("koa");
import Router = require("@koa/router");
import bodyParser = require("koa-bodyparser");
import { config } from "./config";
import { ApiError, reportError } from "./errors";
import { close as closeDb, connect as connectDb } from "./database";
import { init as initAuth } from "./auth";

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
    reportError(error, ctx);
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
    throw new ApiError(401, "API key is required");
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

// Server close-down
const abortController = new AbortController();
function closeServer() {
  console.log("Closing server");
  abortController.abort();
}
function startServer() {
  console.log("Starting server");
  app.listen({
    port: config.APP_PORT,
    signal: abortController.signal,
  }, () => {
    console.log(`Server listening on port ${config.APP_PORT}`.yellow);
  });
}

async function main() {
  console.log("Calling startup routines".green);
  await connectDb(); // connect to database first
  await Promise.all([ // run all other startup routines in parallel
    initAuth(),
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
    await Promise.all([ // run all shutdown routines in parallel
      closeServer(),
      closeDb(),
    ]);
    console.log("Shutdown complete".bgGreen);
  }
}
process.on("SIGINT", onAppClose);
main();
