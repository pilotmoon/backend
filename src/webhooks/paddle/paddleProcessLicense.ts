import { z } from "zod";
import _ from "lodash";
import { getRolo } from "../rolo.js";
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
  const api = getRolo(mode);
  const info = {
    email: paddleArgs.email,
    name: paddleArgs.name,
    product: paddleArgs.product,
    quantity: parseInt(paddleArgs.p_quantity),
    order: paddleArgs.p_order_id,
    origin: "Paddle",
    originData: _.omit(paddleArgs, "p_signature", "email", "name", "product"),
  };
  const { data } = await api.post("/licenseKeys", info);
  return ZLicenseExternal.parse(data);
}
