import Router from "@koa/router";
import { ApiError } from "../../errors.js";
import { config } from "../config.js";
import { processLicense } from "./lizhiProcessLicense.js";
import { validateLizhiWebhook } from "./lizhiValidateWebhook.js";

export const router = new Router();

router.post("/webhooks/lizhi/generateLicense", async (ctx) => {
  const key = validateLizhiWebhook(ctx);
  if (!key) {
    throw new ApiError(401, "Missing or invalid API key");
  }
  const license = await processLicense(ctx.request.body, key.name, key.kind);
  if (!license) {
    throw new ApiError(500, "Error generating license");
  }
  ctx.body = {
    web_url: config.ROLO_URL_CANONICAL + license.file.url,
    license_id: license.id,
    file_name: license.file.name,
    file_data: license.file.data,
  };
  ctx.status = 201;
});
