import { z } from "zod";
import { ZLicenseExternal } from "../../common/licenseFileObject.js";
import {
  ZSaneEmail,
  ZSaneQuantity,
  ZSaneString,
} from "../../common/saneSchemas.js";
import { getRolo } from "../rolo.js";
import { log } from "../../common/log.js";

const ZLicenseArgs = z.object({
  name: ZSaneString,
  email: ZSaneEmail,
  order: ZSaneString,
  product: z.enum(["com.pilotmoon.popclip", "com.example.product"]),
  quantity: ZSaneQuantity.optional(),
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
  const info = {
    email: licenseArgs.email,
    name: licenseArgs.name,
    product: licenseArgs.product,
    quantity: licenseArgs.quantity ?? 1,
    order: licenseArgs.order,
    origin,
  };
  const { data } = await api.post("/licenseKeys", info);
  return ZLicenseExternal.parse(data);
}
