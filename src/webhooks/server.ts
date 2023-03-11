import "colors";
import Koa from "koa";
import Router from "@koa/router";
import { config } from "./config.js";
const router = new Router();

const app = new Koa({ proxy: true });
app.use(router.routes());
app.use(router.allowedMethods());

function log(...args: any[]) {
  console.log(...args);
}

router.get("/", (ctx) => {
  ctx.body = "twix " + config.COMMIT_HASH;
});

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
