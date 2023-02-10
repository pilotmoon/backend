import Koa = require("koa");
import Router = require("@koa/router");
import bodyParser = require("koa-bodyparser");
import { APP_PORT } from "./config";
import { ApiError, reportError } from "./errors";
import { connect } from "./database";
import "colors";

// set up router
const router = new Router();

// healthcheck endpoint
router.get("/healthcheck", async (ctx, next) => {
  ctx.body = { "healthcheck": true };
  await next();
});

// add sub-routers
router.use(require("./routers/apiKeys").router.routes());

// set up Koa app
const app = new Koa();

// standard error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    reportError(error, ctx);
  }
});

// replace _id with id for string ids
app.use(async (ctx, next) => {
  await next();
  if (ctx.body && ctx.body._id) {
    if (typeof ctx.body._id === "string") {
      ctx.body.id = ctx.body._id;
    }
    delete ctx.body._id;
  }
});

// require API key for all routes
app.use(async (ctx, next) => {
  const apiKey = ctx.request.headers["x-api-key"];
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    throw new ApiError(401, "API key is required");
  }
  await next();
});

// remove version prefix from all routes
app.use(async (ctx, next) => {
  ctx.url = ctx.url.replace("/v1", "");
  await next();
});

app.use(bodyParser({ enableTypes: ["json"] }));
app.use(router.routes());
app.use(router.allowedMethods());

async function main() {
  await connect();
  app.listen(
    APP_PORT,
    () => console.log(`Server listening on port ${APP_PORT}`.yellow),
  );
}
main();
