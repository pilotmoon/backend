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
import { logAccess } from "./middleware/logAccess";

import { housekeep as housekeepLogAccess } from "./middleware/logAccess";

import { init as initRegistriesController } from "./controllers/registriesController";
import { init as initLicenseKeysController } from "./controllers/licenseKeysController";
import { init as initApiKeysController } from "./controllers/apiKeysController";
import { init as initLogAccess } from "./middleware/logAccess";

import { router as healthRouter } from "./routers/healthRouter";
import { router as apiKeysRouter } from "./routers/apiKeysRouter";
import { router as registriesRouter } from "./routers/registriesRouter";
import { router as licenseKeysRouter } from "./routers/licenseKeysRouter";
import { hours } from "./middleware/timeIntervals";

// set up main router
const mainRouter = makeRouter();
mainRouter.use(healthRouter.routes());
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
app.context.getLocation = function (
  name: string,
  params?: any,
  query?: {},
  full?: boolean,
) {
  let result = mainRouter.url(name, params);
  if (result instanceof Error) throw result;
  if (query) {
    result += "?" + new URLSearchParams(query).toString();
  }
  if (full) {
    result = `${config.APP_URL}${result}`;
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
      clearInterval(housekeepingTimer),
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
    housekeep(), // run housekeeping once at startup
    initLogAccess(),
    initApiKeysController(),
    initRegistriesController(),
    initLicenseKeysController(),
  ]);
  log("Startup complete".green);
  startServer();
})();
