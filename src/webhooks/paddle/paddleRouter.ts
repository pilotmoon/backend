import { processAlert, processLicense } from "./paddleProcessLicense.js";
import { validatePaddleWebhook } from "./paddleValidateWebhook.js";
import Router from "@koa/router";
import { config } from "../config.js";
import { ApiError } from "../../errors.js";
import { paddleCredentials } from "../paddle.js";
import { Context } from "koa";
import { log } from "../../logger.js";

export const router = new Router();

function validate(ctx: Context) {
  const signers = [
    { pubkey: paddleCredentials.production.publicKey, mode: "live" as const },
    { pubkey: paddleCredentials.sandbox.publicKey, mode: "test" as const },
  ];
  const signed = signers.find((signer) =>
    validatePaddleWebhook(ctx, signer.pubkey)
  );
  if (!signed) {
    throw new ApiError(400, "Invalid signature");
  }
  log("Webhook signature verified, mode:", signed.mode);
  return signed;
}

router.post("/webhooks/paddle/generateLicense", async (ctx) => {
  const signed = validate(ctx);
  const { file } = await processLicense(ctx.request.body, signed.mode);
  const escapedName = file.name.replaceAll("_", "\\_");
  ctx.body = `[${escapedName}](${config.ROLO_URL_CANONICAL}${file.url})`;
});

router.post("/webhooks/paddle/handleAlert", async (ctx) => {
  const signed = validate(ctx);
  await processAlert(ctx.request.body, signed.mode);
  ctx.status = 200;
});
