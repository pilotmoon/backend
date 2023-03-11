import { z } from "zod";
import axios from "axios";
import { config } from "../config.js";

const ZPaddleArgs = z.object({
  p_order_id: z.string(),
  p_quantity: z.string(),
  email: z.string(),
  name: z.string(),
  product: z.string(),
});

function getApi(kind: "test" | "live") {
  let apiKey;
  if (kind === "test") {
    apiKey = config.ROLO_APIKEY_TEST;
  } else if (kind === "live") {
    apiKey = config.ROLO_APIKEY_LIVE;
  } else {
    throw new Error(`Invalid kind '${kind}'`);
  }
  return axios.create({
    baseURL: config.ROLO_URL,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });
}

export async function processLicense(args: unknown, mode: "test" | "live") {
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
