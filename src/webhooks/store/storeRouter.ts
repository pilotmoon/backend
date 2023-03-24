import Router from "@koa/router";
import { ApiError } from "../../errors.js";
import { config } from "../config.js";
import { processLicense } from "./storeProcessLicense.js";
import { validateStoreWebhook } from "./storeValidateWebhook.js";

export const router = new Router();

router.post("/webhooks/:name(lizhi|store)/generateLicense", async (ctx) => {
  const key = validateStoreWebhook(ctx);
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