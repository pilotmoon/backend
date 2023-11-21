import axios from "axios";
import { z } from "zod";
import { config } from "./config.js";

const ZCred = z.object({
  vendorId: z.string(),
  vendorSecret: z.string(),
  publicKey: z.string(),
});
const ZCreds = z.object({
  production: ZCred,
  sandbox: ZCred,
});
export const paddleCredentials = ZCreds.parse(
  JSON.parse(config.PADDLE_CREDENTIALS),
);

export function getPaddleVendorsApi(mode: "test" | "live") {
  const creds = paddleCredentials[mode === "test" ? "sandbox" : "production"];
  const prefix = mode === "test" ? "sandbox-" : "";
  return axios.create({
    baseURL: `https://${prefix}vendors.paddle.com/api`,
    transformRequest: [
      (data) => {
        return {
          vendor_id: creds.vendorId,
          vendor_auth_code: creds.vendorSecret,
          ...data,
        };
      },
      ...(axios.defaults.transformRequest as []),
    ],
  });
}

export function getPaddleCheckoutApi() {
  return axios.create({
    baseURL: "https://checkout.paddle.com/api",
  });
}
