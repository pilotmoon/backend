import "./globals";
import { makeRouter, makeServer } from "./koaWrapper";
import bodyParser = require("koa-bodyparser");
import { config } from "./config";
import { ApiError } from "./errors";
import { close as closeDb, connect as connectDb } from "./database";
import { init as initAuth } from "./controllers/authController";
import { init as initProducts } from "./controllers/productsController";
import { log } from "./logger";
import { asciiHello } from "./static";
import { authorize } from "./middleware/authorize";
import { processPagination } from "./middleware/processPagination";
import { handleError } from "./middleware/handleError";
import { formatBody } from "./middleware/formatBody";
import { checkAccess } from "./middleware/checkAccess";

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
  const result = mainRouter.url(name, params);
  if (result instanceof Error) {
    throw result;
  }
  return result;
};

// middleware to measure response time
server.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const time = `${Date.now() - start} ms`;
  log("Response time:", time);
  ctx.set("X-Response-Time", time);
});

// root GET is allowed without auth
const rootRouter = makeRouter();
rootRouter.get("/", (ctx) => {
  ctx.body = asciiHello();
});

server.use(handleError);
server.use(formatBody);
server.use(checkAccess);
server.use(rootRouter.routes());
server.use(rootRouter.allowedMethods());
server.use(authorize);
server.use(processPagination());

// error if content-type is not application/json
server.use(async (ctx, next) => {
  const match = ctx.request.is("application/json");
  const hasContent = typeof ctx.request.length === "number" &&
    ctx.request.length > 0;
  if (hasContent && match !== "application/json") {
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

// server startup and shutdown
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

// app close-down
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

// app startup
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
