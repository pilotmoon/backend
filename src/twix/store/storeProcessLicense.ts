import { z } from "zod";
import { log } from "../../common/log.js";
import {
  ZSaneEmail,
  ZSaneQuantity,
  ZSaneString,
} from "../../common/saneSchemas.js";
import { ZLicenseKey } from "../licenseKeySchema.js";
import { getRolo } from "../rolo.js";
import { dates } from "../dates.js";

const ZLicenseArgs = z.object({
  name: ZSaneString,
  email: ZSaneEmail,
  order: ZSaneString,
  product: z.enum(["com.pilotmoon.popclip", "com.example.product"]),
  quantity: ZSaneQuantity.optional(),
  valid_months: z.number().int().min(1).optional(),
});

export async function processLicense(
  args: unknown,
  origin: string,
  mode: "test" | "live",
) {
  // create license
  log("mode: ", mode);
  const licenseArgs = ZLicenseArgs.parse(args);
  const api = getRolo(mode);
  const { date, expiryDate } = dates(licenseArgs);

  const info = {
    email: licenseArgs.email,
    name: licenseArgs.name,
    product: licenseArgs.product,
    quantity: licenseArgs.quantity ?? 1,
    order: licenseArgs.order,
    origin,
    date,
    expiryDate,
  };
  const { data } = await api.post("/licenseKeys", info);
  return ZLicenseKey.parse(data);
}
