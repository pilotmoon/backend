import "./globals";
import Koa = require("koa");
import Router = require("@koa/router");
import bodyParser = require("koa-bodyparser");
import { config } from "./config";
import { ApiError, reportError } from "./errors";
import { connect, onAppClose as onAppCloseDb } from "./database";
import { onAppStart as onAppStartAuth } from "./auth";

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

const abortController = new AbortController();
function onAppCloseServer() {
  console.log("Closing server");
  abortController.abort();
}

async function main() {
  await connect();
  await Promise.all([ // run all startup routines in parallel
    onAppStartAuth(),
  ]);
  app.listen({
    port: config.APP_PORT,
    signal: abortController.signal,
  }, () => {
    console.log(`Server listening on port ${config.APP_PORT}`.yellow);
  });
}

// Close-down routines
let closing = false;
process.on("SIGINT", async function () {
  console.log("SIGINT received".cyan);
  if (!closing) {
    closing = true;
    console.log("Calling shutdown routines".green);
    await Promise.all([ // run all shutdown routines in parallel
      onAppCloseServer(),
      onAppCloseDb(),
    ]);
    console.log("All shutdown routines complete".green);
  }
});

main();
