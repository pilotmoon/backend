import _ from "lodash";
import { z } from "zod";
import { ZLicenseExternal } from "../../licenseFileObject.js";
import { getRolo } from "../rolo.js";

const ZLicenseArgs = z.object({
  p_order_id: z.string(),
  p_quantity: z.string(),
  email: z.string(),
  name: z.string(),
  product: z.string(),
});

export async function processLicense(args: unknown, mode: "test" | "live") {
  // create license
  const paddleArgs = ZLicenseArgs.passthrough().parse(args);
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
