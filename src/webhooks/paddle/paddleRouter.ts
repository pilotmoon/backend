import { ApiError } from "../../errors.js";
import { processLicense } from "./paddleProcessLicense.js";
import { validatePaddleWebhook } from "./paddleValidateWebhook.js";
import Router from "@koa/router";
import { config } from "../config.js";

export const router = new Router();

// Paddle IP Allowlist
const ipAllowedSandbox = [
  "34.194.127.46",
  "54.234.237.108",
  "3.208.120.145",
  "44.226.236.210",
  "44.241.183.62",
  "100.20.172.113",
];
const ipAllowedProduction = [
  "34.232.58.13",
  "34.195.105.136",
  "34.237.3.244",
  "35.155.119.135",
  "52.11.166.252",
  "34.212.5.7",
];
const ipAllowedDev = [
  process.env.IP_DEV_1,
];
function checkAccess(ips: string[]): "test" | "live" {
  if (ipAllowedSandbox.includes(ips[0])) {
    return "test";
  }
  if (ipAllowedProduction.includes(ips[0])) {
    return "live";
  }
  if (ipAllowedDev.includes(ips[0])) {
    return "test";
  }
  throw new ApiError(403, "IP address not allowed");
}

router.post("/webhooks/paddle/generateLicense", async (ctx) => {
  const mode = checkAccess(ctx.ips);
  validatePaddleWebhook(ctx.request.body, config.PADDLE_PUBKEY);
  const file = await processLicense(ctx.request.body, mode);
  ctx.body = `[${file.name}](${config.ROLO_URL_CANONICAL}${file.url})`;
});
