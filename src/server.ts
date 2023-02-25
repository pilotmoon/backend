import "./globals";
import { makeRouter, makeServer } from "./koaWrapper";
import bodyParser = require("koa-bodyparser");
import { config } from "./config";
import { ApiError } from "./errors";
import { close as closeDb, connect as connectDb } from "./database";
import { log } from "./logger";
import { asciiHello } from "./static";
import { authorize } from "./middleware/authorize";
import { processPagination } from "./middleware/processPagination";
import { handleError } from "./middleware/handleError";
import { formatBody } from "./middleware/formatBody";
import { checkAccess } from "./middleware/checkAccess";
import { measureResponseTime } from "./middleware/measureResponseTime";
import { enforceJson } from "./middleware/enforceJson";

// set up main router
const mainRouter = makeRouter();
mainRouter.use(require("./routers/healthRouter").router.routes());
mainRouter.use(require("./routers/apiKeysRouter").router.routes());
mainRouter.use(require("./routers/productsRouter").router.routes());
mainRouter.use(require("./routers/licenseKeysRouter").router.routes());

// the root router simply serves a title screen, bypassing auth
const rootRouter = makeRouter();
rootRouter.get("/", (ctx) => {
  ctx.body = asciiHello();
});

// create Koa server
const app = makeServer();

// function that routers can use for generating url for Location header
app.context.getLocation = function (name: string, params?: any) {
  const result = mainRouter.url(name, params);
  if (result instanceof Error) throw result;
  return result;
};

// body parser that only accepts JSON
const parseJsonBody = bodyParser({
  enableTypes: ["json"],
  onerror: () => {
    throw new ApiError(400, "Invalid JSON");
  },
});

// add all middleware
app.use(measureResponseTime);
app.use(handleError);
app.use(formatBody);
app.use(checkAccess);
app.use(rootRouter.routes());
app.use(rootRouter.allowedMethods());
app.use(authorize);
app.use(processPagination());
app.use(enforceJson);
app.use(parseJsonBody);
app.use(mainRouter.routes());
app.use(mainRouter.allowedMethods());

// server startup and shutdown
const abortController = new AbortController();
function startServer() {
  log("Starting server");
  app.listen({
    port: config.APP_PORT,
    signal: abortController.signal,
  }, () => {
    log(`Server listening on port ${config.APP_PORT}`.bgCyan);
  });
}
function closeServer() {
  log("Closing server");
  abortController.abort();
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
    require("./controllers/authController").init(),
    require("./controllers/productsController").init(),
    require("./controllers/licenseKeysController").init(),
  ]);
  log("Startup complete".green);
  startServer();
})();
