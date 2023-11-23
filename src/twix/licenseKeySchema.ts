import { z } from "zod";

export const ZLicenseKeyFile = z.object({
  object: z.literal("licenseKeyFile"),
  name: z.string(),
  data: z.string(),
  url: z.string(),
});

export const ZLicenseKey = z.object({
  id: z.string(),
  object: z.literal("licenseKey"),
  file: ZLicenseKeyFile,
});
