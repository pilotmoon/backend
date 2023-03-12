import { z } from "zod";
import _ from "lodash";
import { getApi } from "../getApi.js";
import { ZLicenseExternal } from "../../licenseFileObject.js";

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
  const paddleArgs = ZPaddleArgs.passthrough().parse(args);
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
  const { data } = await api.post("/licenseKeys", info);
  return ZLicenseExternal.parse(data);
}
