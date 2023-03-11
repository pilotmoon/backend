import { z } from "zod";
import _ from "lodash";
import { getApi } from "../getApi.js";

const ZPaddleArgs = z.object({
  p_order_id: z.string(),
  p_quantity: z.string(),
  email: z.string(),
  name: z.string(),
  product: z.string(),
});

export async function processLicense(args: unknown, mode: "test" | "live") {
  // create license
  console.log("mode: ", mode);
  console.log("create license with args: ", args);
  const paddleArgs = ZPaddleArgs.passthrough().parse(args);
  console.log("paddleArgs: ", paddleArgs);

  const api = getApi(mode);
  const info = {
    email: paddleArgs.email,
    name: paddleArgs.name,
    product: paddleArgs.product,
    quantity: parseInt(paddleArgs.p_quantity),
    order: paddleArgs.p_order_id,
    origin: "Paddle",
    originData: _.omit(paddleArgs, "p_signature"),
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
