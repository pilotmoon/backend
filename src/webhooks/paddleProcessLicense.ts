import { z } from "zod";
import axios from "axios";

const ZPaddleArgs = z.object({
  p_order_id: z.string(),
  p_quantity: z.string(),
  email: z.string(),
  name: z.string(),
  product: z.string(),
});
type PaddleArgs = z.infer<typeof ZPaddleArgs>;

function getApi(kind: "test" | "live") {
  const apiKey = process.env[`APIKEY_${kind.toUpperCase()}`];
  if (!apiKey) {
    throw new Error(`missing APIKEY_${kind.toUpperCase()}`);
  }
  return axios.create({
    baseURL: "https://api.pilotmoon.com/v2",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });
}

export async function processLicense(args: any, mode: "test" | "live") {
  // create license
  console.log("mode: ", mode);
  console.log("create license with args: ", args);
  const paddleArgs = ZPaddleArgs.parse(args);
  console.log("paddleArgs: ", paddleArgs);

  const api = getApi(mode);
  const info = {
    email: paddleArgs.email,
    name: paddleArgs.name,
    product: paddleArgs.product,
    quantity: parseInt(paddleArgs.p_quantity),
    order: paddleArgs.p_order_id,
    origin: "Paddle",
    originData: args,
  };
  console.log("info: ", info);
  const { data } = await api.post("/licenseKeys", info);
  console.log("data: ", data);

  if (
    data.object === "licenseKey" && data.file?.object === "licenseKeyFile"
  ) {
    return data.file;
  } else {
    throw new Error("invalid response from api");
  }
}
