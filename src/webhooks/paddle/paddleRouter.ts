import { processLicense } from "./paddleProcessLicense.js";
import { validatePaddleWebhook } from "./paddleValidateWebhook.js";
import Router from "@koa/router";
import { config } from "../config.js";
import { z } from "zod";
import { ApiError } from "../../errors.js";

export const router = new Router();

router.post("/webhooks/paddle/generateLicense", async (ctx) => {
  const productionSigned = validatePaddleWebhook(
    ctx.request.body,
    config.PADDLE_PUBKEY_PRODUCTION,
  );
  const sandboxSigned = validatePaddleWebhook(
    ctx.request.body,
    config.PADDLE_PUBKEY_SANDBOX,
  );
  if (!sandboxSigned && !productionSigned) {
    throw new ApiError(400, "Invalid signature");
  }
  const mode = productionSigned ? "live" : "test";
  const file = await processLicense(ctx.request.body, mode);
  ctx.body = `[${file.name}](${config.ROLO_URL_CANONICAL}${file.url})`;
});
