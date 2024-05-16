import cors from "@koa/cors";
import "colors";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import { ApiError } from "../common/errors.js";
import { assertSuccess, waitFor } from "../common/init.js";
import { log } from "../common/log.js";
import { handleError } from "../common/middleware/handleError.js";
import { measureResponseTime } from "../common/middleware/measureResponseTime.js";
import { hours } from "../common/timeIntervals.js";
import { router as commandsRouter } from "./commands.js";
import { config } from "./config.js";
import { router as directoryRouter } from "./directory/directoryRouter.js";
import { getConfig as initEmail } from "./email.js";
import { start as initReports, stop as stopReports } from "./emailReports.js";
import {
  housekeep as housekeepGithub,
  init as initGithub,
} from "./githubClient.js";
import { makeRouter, makeServer } from "./koaWrapper.js";
import { openRemoteLog } from "./middleware/openRemoteLog.js";
import { getPaddleCredentials as initPaddle } from "./paddle.js";
import { router as paddleRouter } from "./paddle/paddleRouter.js";
import { remoteConfigReady } from "./remoteConfig.js";
import { getCouponOffers as initCatalog } from "./store/catalog.js";
import { router as storeRouter } from "./store/storeRouter.js";
import { getKeys as initStore } from "./store/storeValidateWebhook.js";
import {
  init as initRebuildSite,
  shutdown as shutdownRebuildSite,
} from "./rebuildSite.js";

const router = makeRouter();
router.use(paddleRouter.routes());
router.use(storeRouter.routes());
router.use(directoryRouter.routes());
router.use(commandsRouter.routes());

// serve a title screen
router.get("/", (ctx) => {
  ctx.body = `twix ${config.COMMIT_HASH}`;
});

const app = makeServer();

// set up CORS for frontend requests
app.use(
  cors({
    origin: (context: Koa.Context) => {
      const origin = context.request.header.origin;
      const path = context.request.path;
      if (
        path.startsWith("/frontend/") &&
        (origin === "https://www.popclip.app" ||
          origin?.startsWith("http://localhost:"))
      ) {
        return origin;
      }
      return "";
    },
  }),
);

// body parser that accepts JSON and form data
const parseJsonBody = bodyParser({
  enableTypes: ["json", "form"],
  onerror: () => {
    throw new ApiError(400, "Invalid JSON");
  },
});

// add all middleware
app.use(measureResponseTime);
app.use(openRemoteLog);
app.use(handleError);
app.use(parseJsonBody);
app.use(router.routes());
app.use(router.allowedMethods());

// housekeeping tasks
async function housekeep() {
  log(`Housekeeping ${new Date().getTime()}`.black.bgYellow);
  await housekeepGithub();
}
const housekeepingTimer = setInterval(housekeep, hours(1));

// server startup and shutdown
const abortController = new AbortController();
function startServer() {
  const port = config.TWIX_PORT;
  log("Starting server...");
  app.listen({ port, signal: abortController.signal }, () => {
    log(`Server listening on port ${port}`.black.bgMagenta);
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
    await Promise.allSettled([
      // run all shutdown routines in parallel
      clearInterval(housekeepingTimer),
      closeServer(),
      stopReports(),
      shutdownRebuildSite(),
    ]);
    log("Shutdown complete".bgGreen);
  }
});

log("Twix Starting".black.bgWhite);
log("Current working directory:", process.cwd());

await waitFor("Remote config server", remoteConfigReady);
await waitFor("Rolo", async () => (await fetch(`${config.ROLO_URL}/`)).ok);

await assertSuccess([
  initPaddle(),
  initEmail(),
  initReports(),
  initStore(),
  initCatalog(),
  initGithub(),
  initRebuildSite(),
]);
await housekeep();
log("Startup complete".green);
startServer();
