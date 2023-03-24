import { processLicense } from "./paddleProcessLicense.js";
import { validatePaddleWebhook } from "./paddleValidateWebhook.js";
import Router from "@koa/router";
import { config } from "../config.js";
import { ApiError } from "../../errors.js";
import { paddleCredentials } from "../paddle.js";

export const router = new Router();

router.post("/webhooks/paddle/generateLicense", async (ctx) => {
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
  const { file } = await processLicense(ctx.request.body, signed.mode);
  const escapedName = file.name.replaceAll("_", "\\_");
  ctx.body = `[${escapedName}](${config.ROLO_URL_CANONICAL}${file.url})`;
});
