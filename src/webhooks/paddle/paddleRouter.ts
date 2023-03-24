import { processLicense } from "./paddleProcessLicense.js";
import { validatePaddleWebhook } from "./paddleValidateWebhook.js";
import Router from "@koa/router";
import { config } from "../config.js";
import { ApiError } from "../../errors.js";
import { z } from "zod";

const ZCred = z.object({
  vendorId: z.string(),
  vendorSecret: z.string(),
  publicKey: z.string(),
});
const ZCreds = z.object({
  production: ZCred,
  sandbox: ZCred,
});

const creds = ZCreds.parse(JSON.parse(config.PADDLE_CREDENTIALS));

export const router = new Router();

router.post("/webhooks/paddle/generateLicense", async (ctx) => {
  const signers = [
    { pubkey: creds.production.publicKey, mode: "live" as const },
    { pubkey: creds.sandbox.publicKey, mode: "test" as const },
  ];
  const signed = signers.find((signer) =>
    validatePaddleWebhook(ctx, signer.pubkey)
  );
  if (!signed) {
    throw new ApiError(400, "Invalid signature");
  }
  const { file } = await processLicense(ctx.request.body, signed.mode);
  const escapedName = file.name.replaceAll("_", "\\_");
  ctx.body = `[${escapedName}](${config.ROLO_URL_CANONICAL}${file.url})`;
});
