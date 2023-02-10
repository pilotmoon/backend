import "./globals";
import Koa = require("koa");
import Router = require("@koa/router");
import bodyParser = require("koa-bodyparser");
import { config } from "./config";
import { reportError } from "./errors";
import { close as closeDb, connect as connectDb } from "./database";
import { authMiddleware, init as initAuth, verifyScope } from "./auth";

// set up router
const router = new Router({ prefix: config.PATH_PREFIX });

// healthcheck endpoint
router.get("/healthcheck", async (ctx, next) => {
  await verifyScope("healthcheck:read", ctx.state.auth);
  ctx.body = { "healthcheck": true };
  await next();
});

// add sub-routers
router.use(require("./routers/apiKeys").router.routes());

// set up Koa app
const app = new Koa();

// add function to context for generating full url
app.context.fullUrl = function (name: string, params?: any) {
  console.log("fullUrl", name, params);
  return config.APP_URL + router.url(name, params);
};

// middleware for all error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    reportError(error, ctx);
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

app.use(authMiddleware);
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
