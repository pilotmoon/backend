import { processLicense } from "./paddleProcessLicense.js";
import { validatePaddleWebhook } from "./paddleValidateWebhook.js";
import Router from "@koa/router";
import { config } from "../config.js";
import { z } from "zod";

export const router = new Router();

const ZMode = z.object({
  mode: z.enum(["live", "test"]),
});

router.post("/webhooks/paddle/generateLicense", async (ctx) => {
  validatePaddleWebhook(ctx.request.body, config.PADDLE_PUBKEY);
  const mode = ZMode.parse(ctx.request.body).mode;
  const file = await processLicense(ctx.request.body, mode);
  ctx.body = `[${file.name}](${config.ROLO_URL_CANONICAL}${file.url})`;
});
