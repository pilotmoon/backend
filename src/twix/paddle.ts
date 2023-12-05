import axios from "axios";
import { z } from "zod";
import { getRemoteConfig } from "./remoteConfig.js";

const ZCred = z.object({
  vendorId: z.string(),
  vendorSecret: z.string(),
  publicKey: z.string(),
});
const ZCreds = z.object({
  production: ZCred,
  sandbox: ZCred,
});

let credentials: z.infer<typeof ZCreds>;
export async function getPaddleCredentials() {
  if (!credentials) {
    credentials = ZCreds.parse(await getRemoteConfig("paddle_credentials"));
  }
  return credentials;
}

export async function getPaddleVendorsApi(mode: "test" | "live") {
  const creds = (await getPaddleCredentials())[
    mode === "test" ? "sandbox" : "production"
  ];
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
