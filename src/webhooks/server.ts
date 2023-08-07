import { config } from "./config.js";
import "colors";
import Koa from "koa";
import Router from "@koa/router";
import { router as paddleRouter } from "./paddle/paddleRouter.js";
import { router as storeRouter } from "./store/storeRouter.js";
import { router as iconRouter } from "./icon/iconRouter.js";
import { log } from "../logger.js";
import bodyParser from "koa-bodyparser";
import { ApiError } from "../errors.js";
import { handleError } from "../handleError.js";
import { measureResponseTime } from "../measureResponseTime.js";

const router = new Router();
router.use(paddleRouter.routes());
router.use(storeRouter.routes());
router.use(iconRouter.routes());

// serve a title screen
router.get("/", (ctx) => {
  ctx.body = "twix " + config.COMMIT_HASH;
});

const app = new Koa({ proxy: true });

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
    log(`Server listening on port ${port}`.bgMagenta);
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
    ]);
    log("Shutdown complete".bgGreen);
  }
});

startServer();
