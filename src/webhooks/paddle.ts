import { ApiError } from "../errors.js";
import { processLicense } from "./paddleProcessLicense";
import { validatePaddleWebhook } from "./paddleValidateWebhook";

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

// export async function main(args: any) {
//   return doMain(args, async (ctx) => {
//     const mode = checkAccess(ctx.req.ips);
//     if (ctx.req.path === "/license") {
//       if (ctx.req.method !== "POST") {
//         throw new ApiError(405, "Method not allowed");
//       }
//       validatePaddleWebhook(ctx.req.args);
//       const file = await processLicense(ctx.req.args, mode);
//       ctx.res.body = `[${file.name}](${file.url})`;
//     }
//   });
// }
