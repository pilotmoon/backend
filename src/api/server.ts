import "colors";
import { makeRouter, makeServer } from "./koaWrapper.js";
import bodyParser from "koa-bodyparser";
import { config } from "./config.js";
import { ApiError } from "../errors.js";
import { close as closeDb, connect as connectDb } from "./database.js";
import { log } from "../logger.js";
import { asciiHello } from "./static.js";
import { authorize } from "./middleware/authorize.js";
import { processPagination } from "./middleware/processPagination.js";
import { handleError } from "../handleError.js";
import { formatBody } from "./middleware/formatBody.js";
import { checkAccess } from "./middleware/checkAccess.js";
import { measureResponseTime } from "../measureResponseTime.js";
import { enforceJson } from "./middleware/enforceJson.js";
import { logAccess } from "./middleware/logAccess.js";

import { housekeep as housekeepLogAccess } from "./middleware/logAccess.js";

import { init as initRegistriesController } from "./controllers/registriesController.js";
import { init as initLicenseKeysController } from "./controllers/licenseKeysController.js";
import { init as initApiKeysController } from "./controllers/apiKeysController.js";
import { init as initLogAccess } from "./middleware/logAccess.js";

import { router as healthRouter } from "./routers/healthRouter.js";
import { router as reportsRouter } from "./routers/reportsRouter.js";
import { router as apiKeysRouter } from "./routers/apiKeysRouter.js";
import { router as registriesRouter } from "./routers/registriesRouter.js";
import { router as licenseKeysRouter } from "./routers/licenseKeysRouter.js";
import { hours } from "../timeIntervals.js";

// set up main router
const mainRouter = makeRouter();
mainRouter.use(healthRouter.routes());
mainRouter.use(reportsRouter.routes());
mainRouter.use(apiKeysRouter.routes());
mainRouter.use(registriesRouter.routes());
mainRouter.use(licenseKeysRouter.routes());

// the root router simply serves a title screen, bypassing auth
const rootRouter = makeRouter();
rootRouter.get("/", (ctx) => {
  ctx.body = asciiHello();
});

// create Koa server
const app = makeServer();

// function that routers can use for generating url for Location header
app.context.getLocation = function (name: string, params?: any, query?: {}) {
  let result = mainRouter.url(name, params);
  if (result instanceof Error) throw result;
  if (query) {
    result += "?" + new URLSearchParams(query).toString();
  }
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
app.use(logAccess);
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

// housekeeping tasks
function housekeep() {
  log(`Housekeeping ${new Date().getTime()}`.bgYellow);
  housekeepLogAccess();
}
const housekeepingTimer = setInterval(housekeep, hours(1));

// server startup and shutdown
const abortController = new AbortController();
function startServer() {
  log("Starting server...");
  app.listen(
    {
      port: config.APP_PORT,
      signal: abortController.signal,
    },
    () => {
      log(`Server listening on port ${config.APP_PORT}`.bgMagenta);
    },
  );
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
    await Promise.allSettled([
      // run all shutdown routines in parallel
      clearInterval(housekeepingTimer),
      closeServer(),
      closeDb(),
    ]);
    log("Shutdown complete".bgGreen);
  }
});

// app startup
log("Calling startup routines".green);
await connectDb(); // connect to database first
await Promise.allSettled([
  // run all other startup routines in parallel
  housekeep(), // run housekeeping once at startup
  initLogAccess(),
  initApiKeysController(),
  initRegistriesController(),
  initLicenseKeysController(),
]);
log("Startup complete".green);
startServer();
