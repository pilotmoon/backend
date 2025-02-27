import { z } from "zod";
import { log } from "../../common/log.js";
import {
  ZSaneEmail,
  ZSaneQuantity,
  ZSaneString,
} from "../../common/saneSchemas.js";
import { dates } from "../dates.js";
import { ZLicenseKey } from "../licenseKeySchema.js";
import { getRolo } from "../rolo.js";
import { ApiError } from "../../common/errors.js";

const ZLicenseArgs = z.object({
  name: ZSaneString,
  email: ZSaneEmail,
  order: ZSaneString,
  product: z.enum(["com.pilotmoon.popclip", "com.example.product"]),
  quantity: z.literal(1).optional(),
  valid_months: z.literal(24).optional(),
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

  // verify quantity
  const quantity = licenseArgs.quantity ?? 1;

  // check the validity period
  let description: string | undefined;
  if (licenseArgs.valid_months === 24) {
    description = "Standard Personal License";
  } else if (licenseArgs.valid_months === undefined) {
    description = "Lifetime Personal License";
  }

  // calculate dates
  const { date, expiryDate } = dates(licenseArgs);

  const info = {
    email: licenseArgs.email,
    name: licenseArgs.name,
    product: licenseArgs.product,
    order: licenseArgs.order,
    quantity,
    origin,
    date,
    expiryDate,
    description,
  };
  const { data } = await api.post("/licenseKeys", info);
  return ZLicenseKey.parse(data);
}
