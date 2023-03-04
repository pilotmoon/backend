import { z } from "zod";
import { ZSaneString } from "./identifiers";

// configuration for products
export const ZProductConfig = z.object({
  object: z.literal("productConfig"),
  // name of the product, e.g. "PopClip"
  productName: ZSaneString,
  // file extension for the license key file, e.g. "popcliplicense"
  licenseFileExtension: ZSaneString,
});
export type ProductConfig = z.infer<typeof ZProductConfig>;
