import { processLicense } from "./paddleProcessLicense.js";
import { validatePaddleWebhook } from "./paddleValidateWebhook.js";
import Router from "@koa/router";
import { config } from "../config.js";
import { z } from "zod";
import { ApiError } from "../../errors.js";

export const router = new Router();

router.post("/webhooks/paddle/generateLicense", async (ctx) => {
  const signers = [
    { pubkey: config.PADDLE_PUBKEY_PRODUCTION, mode: "live" as const },
    { pubkey: config.PADDLE_PUBKEY_SANDBOX, mode: "test" as const },
  ];
  const signed = signers.find((signer) =>
    validatePaddleWebhook(ctx, signer.pubkey)
  );
  if (!signed) {
    throw new ApiError(400, "Invalid signature");
  }
  const { file } = await processLicense(ctx.request.body, signed.mode);
  ctx.body = `[${file.name}](${config.ROLO_URL_CANONICAL}${file.url})`;
});
