import _ from "lodash";
import { z } from "zod";
import { log } from "../../common/log.js";
import { dates } from "../dates.js";
import { ZLicenseKey } from "../licenseKeySchema.js";
import { getRolo } from "../rolo.js";

const ZLicenseArgs = z.object({
  p_order_id: z.string(),
  p_quantity: z.string(),
  email: z.string(),
  name: z.string(),
  product: z.string(),
  valid_months: z.coerce.number().int().min(1).optional(),
});

export async function processLicense(args: unknown, mode: "test" | "live") {
  // create license
  log("Processing license:", args);
  const paddleArgs = ZLicenseArgs.passthrough().parse(args);
  const api = getRolo(mode);
  const { date, expiryDate } = dates(paddleArgs);
  const info = {
    date,
    expiryDate,
    email: paddleArgs.email,
    name: paddleArgs.name,
    product: paddleArgs.product,
    quantity: Number.parseInt(paddleArgs.p_quantity),
    order: paddleArgs.p_order_id,
    origin: "Paddle",
    originData: _.omit(paddleArgs, "p_signature", "email", "name", "product"),
  };
  const { data } = await api.post("/licenseKeys", info);
  return ZLicenseKey.parse(data);
}
