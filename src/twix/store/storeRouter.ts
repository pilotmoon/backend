import Router from "@koa/router";
import { ApiError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import { config } from "../config.js";
import { processCoupon } from "./storeProcessCoupon.js";
import { processLicense } from "./storeProcessLicense.js";
import { processPrices } from "./storeProcessPrices.js";
import { validateStoreWebhook } from "./storeValidateWebhook.js";

export const router = new Router();

router.post("/webhooks/store/generateLicense", async (ctx) => {
  const key = await validateStoreWebhook(ctx);
  if (!key) {
    throw new ApiError(401, "Missing or invalid API key");
  }
  const license = await processLicense(ctx.request.body, key.name, key.kind);
  ctx.body = {
    web_url: config.ROLO_URL_CANONICAL + license.file.url,
    license_id: license.id,
    file_name: license.file.name,
    file_data: license.file.data,
  };
  ctx.status = 201;
});

router.post("/webhooks/store/generateCoupon", async (ctx) => {
  const key = await validateStoreWebhook(ctx);
  if (!key) {
    throw new ApiError(401, "Missing or invalid API key");
  }
  ctx.body = await processCoupon(ctx.request.body, key.name, key.kind);
  ctx.status = 201;
});

router.get("/frontend/store/getPrices", async (ctx) => {
  const sourceIp = ctx.request.ip;
  const product = ctx.query.product;
  if (typeof product !== "string") {
    throw new ApiError(400, "'product' query parameter is required");
  }
  log(`Request received from IP: ${sourceIp}`);
  const result = await processPrices(sourceIp, product);
  log("Sending prices for", result.country);
  ctx.set("Cache-Control", "max-age=900");
  ctx.body = result;
});
