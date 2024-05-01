import "colors";
import bodyParser from "koa-bodyparser";
import { ApiError } from "../common/errors.js";
import { assertSuccess } from "../common/init.js";
import { log, loge } from "../common/log.js";
import { handleError } from "../common/middleware/handleError.js";
import { measureResponseTime } from "../common/middleware/measureResponseTime.js";
import { config } from "./config.js";
import { close as closeDb, connect as connectDb } from "./database.js";
import { makeRouter, makeServer } from "./koaWrapper.js";
import { authorize } from "./middleware/authorize.js";
import { enforceJson } from "./middleware/enforceJson.js";
import { formatBody } from "./middleware/formatBody.js";
import { logAccess } from "./middleware/logAccess.js";
import { processPagination } from "./middleware/processPagination.js";
import { asciiHello } from "./static.js";

import { housekeep as housekeepLogAccess } from "./middleware/logAccess.js";
import { housekeep as housekeepLogs } from "./controllers/logsController.js";

import { init as initApiKeysController } from "./controllers/apiKeysController.js";
import { init as initLicenseKeysController } from "./controllers/licenseKeysController.js";
import { init as initRegistriesController } from "./controllers/registriesController.js";
import { init as initLogsController } from "./controllers/logsController.js";
import { init as initBlobsController } from "./controllers/blobsController.js";
import { init as initExtensionsController } from "./controllers/extensionsController.js";
import { init as initAuthorsController } from "./controllers/authorsController.js";

import { init as initLogAccess } from "./middleware/logAccess.js";

import { hours } from "../common/timeIntervals.js";
import { router as apiKeysRouter } from "./routers/apiKeysRouter.js";
import { router as healthRouter } from "./routers/healthRouter.js";
import { router as licenseKeysRouter } from "./routers/licenseKeysRouter.js";
import { router as registriesRouter } from "./routers/registriesRouter.js";
import { router as reportsRouter } from "./routers/reportsRouter.js";
import { router as logsRouter } from "./routers/logsRouter.js";
import { router as blobsRouter } from "./routers/blobsRouter.js";
import { router as extensionsRouter } from "./routers/extensionsRouter.js";
import { router as authorsRouter } from "./routers/authorsRouter.js";
import { setSecretKey } from "./secrets.js";

// first set the encryption key, if we have one
if (config.APP_SECRET) {
  setSecretKey(config.APP_SECRET);
}

// set up main router
const mainRouter = makeRouter();
mainRouter.use(healthRouter.routes());
mainRouter.use(reportsRouter.routes());
mainRouter.use(apiKeysRouter.routes());
mainRouter.use(registriesRouter.routes());
mainRouter.use(licenseKeysRouter.routes());
mainRouter.use(logsRouter.routes());
mainRouter.use(blobsRouter.routes());
mainRouter.use(extensionsRouter.routes());
mainRouter.use(authorsRouter.routes());

// the root router simply serves a title screen, bypassing auth
const rootRouter = makeRouter();
rootRouter.get("/", (ctx) => {
  ctx.body = asciiHello();
});

// create Koa server
const app = makeServer();

// function that routers can use for generating url for Location header
app.context.getLocation = (
  name: string,
  params?: Record<string, string>,
  query?: Record<string, string>,
) => {
  let result = mainRouter.url(name, params);
  if (result instanceof Error) throw result;
  if (query) {
    result += `?${new URLSearchParams(query).toString()}`;
  }
  return result;
};

// body parser that only accepts JSON
const parseJsonBody = bodyParser({
  enableTypes: ["json"],
  jsonLimit: "16mb",
  onerror: () => {
    throw new ApiError(400, "Invalid JSON");
  },
});

// add all middleware
app.use(measureResponseTime);
app.use(logAccess);
app.use(handleError);
app.use(formatBody);
app.use(rootRouter.routes());
app.use(rootRouter.allowedMethods());
app.use(authorize);
app.use(processPagination());
app.use(enforceJson);
app.use(parseJsonBody);
app.use(mainRouter.routes());
app.use(mainRouter.allowedMethods());

// housekeeping tasks
async function housekeep() {
  log(`Housekeeping ${new Date().getTime()}`.black.bgYellow);
  await housekeepLogAccess();
  await housekeepLogs();
}
const housekeepingTimer = setInterval(housekeep, hours(1));

// server startup and shutdown
const abortController = new AbortController();
function startServer() {
  log("Starting server...");
  app.listen(
    {
      port: config.ROLO_PORT,
      signal: abortController.signal,
    },
    () => {
      log(`Server listening on port ${config.ROLO_PORT}`.black.bgMagenta);
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
await assertSuccess([
  initLogAccess(),
  initApiKeysController(),
  initRegistriesController(),
  initLicenseKeysController(),
  initLogsController(),
  initBlobsController(),
  initExtensionsController(),
  initAuthorsController(),
]);
await housekeep();
log("Startup complete".green);
startServer();
