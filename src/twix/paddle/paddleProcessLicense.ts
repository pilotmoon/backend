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
  passthrough: z.string().optional(),
});

const ZPassthroughArgs = z.object({
  flow_id: z.string().length(24).optional(),
});

export async function processLicense(args: unknown, mode: "test" | "live") {
  // create license
  log("Processing license:", args);
  const paddleArgs = ZLicenseArgs.passthrough().parse(args);
  if (paddleArgs.passthrough) {
    let obj;
    try {
      obj = JSON.parse(paddleArgs.passthrough);
    } catch (e) {
      log("Ignoring error parsing passthrough JSON:", e);
    }
    log({ passthrough: paddleArgs.passthrough, obj });
    const passthroughArgs = ZPassthroughArgs.safeParse(obj);
    if (passthroughArgs.success) {
      log("Passthrough args:", passthroughArgs.data);
      paddleArgs.passthrough_data = passthroughArgs.data;
    } else {
      log("Error parsing passthrough args:", passthroughArgs.error.message);
    }
  }
  const api = getRolo(mode);
  const { date, expiryDate } = dates(paddleArgs);
  const [product, description] = paddleArgs.product.split("/");
  const info = {
    date,
    expiryDate,
    email: paddleArgs.email,
    name: paddleArgs.name,
    product,
    description,
    quantity: Number.parseInt(paddleArgs.p_quantity),
    order: paddleArgs.p_order_id,
    origin: "Paddle",
    originData: _.omit(
      paddleArgs,
      "p_signature",
      "email",
      "name",
      "product",
      "passthrough",
    ),
  };
  const { data } = await api.post("/licenseKeys", info);
  return ZLicenseKey.parse(data);
}
