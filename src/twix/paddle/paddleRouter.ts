import Router from "@koa/router";
import { Context } from "koa";
import { ApiError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import { config } from "../config.js";
import { getPaddleCredentials } from "../paddle.js";
import { processAlert } from "./paddleProcessAlert.js";
import { processLicense } from "./paddleProcessLicense.js";
import { validateWebhook } from "./paddleValidateWebhook.js";

export const router = new Router();

async function validate(ctx: Context) {
  const signers = [
    {
      pubkey: (await getPaddleCredentials()).production.publicKey,
      mode: "live" as const,
    },
    {
      pubkey: (await getPaddleCredentials()).sandbox.publicKey,
      mode: "test" as const,
    },
  ];
  const signed = signers.find((signer) => validateWebhook(ctx, signer.pubkey));
  if (!signed) {
    throw new ApiError(400, "Invalid signature");
  }
  log("Webhook signature verified, mode:", signed.mode);
  return signed;
}

router.post("/webhooks/paddle/generateLicense", async (ctx) => {
  const signer = await validate(ctx);
  const { file } = await processLicense(ctx.request.body, signer.mode);
  const escapedName = file.name.replaceAll("_", "\\_");
  ctx.body = `[${escapedName}](${config.ROLO_URL_CANONICAL}${file.url})`;
});

router.post("/webhooks/paddle/handleAlert", async (ctx) => {
  const signer = await validate(ctx);
  await processAlert(ctx.request.body, signer.mode);
  ctx.status = 200;
});
