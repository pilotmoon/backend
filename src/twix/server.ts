import cors from "@koa/cors";
import Router from "@koa/router";
import "colors";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import { ApiError } from "../rolo/errors.js";
import { handleError } from "../handleError.js";
import { log } from "../logger.js";
import { measureResponseTime } from "../measureResponseTime.js";
import { config } from "./config.js";
import { router as paddleRouter } from "./paddle/paddleRouter.js";
import { start as initReports, stop as stopReports } from "./reports.js";
import { router as storeRouter } from "./store/storeRouter.js";

const router = new Router();
router.use(paddleRouter.routes());
router.use(storeRouter.routes());

// serve a title screen
router.get("/", (ctx) => {
  ctx.body = `twix ${config.COMMIT_HASH}`;
});

const app = new Koa({ proxy: true });

// app.use(cors({
//   origin: '*',
// }));

// body parser that accepts JSON and form data
const parseJsonBody = bodyParser({
  enableTypes: ["json", "form"],
  onerror: () => {
    throw new ApiError(400, "Invalid JSON");
  },
});

// add all middleware
app.use(measureResponseTime);
app.use(handleError);
app.use(parseJsonBody);
app.use(router.routes());
app.use(router.allowedMethods());

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
      closeServer(),
      stopReports(),
    ]);
    log("Shutdown complete".bgGreen);
  }
});

initReports();
startServer();
