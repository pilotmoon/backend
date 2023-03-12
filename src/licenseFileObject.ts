import { z } from "zod";

// schema for the json wrapper for the license key file

export const ZLicenseFileObject = z.object({
  // literal string "licenseKeyFile"
  object: z.literal("licenseKeyFile"),
  // license key filename, e.g. "John_Doe.popcliplicense"
  name: z.string(),
  // license file content as plist string
  plist: z.string(),
  // license key file content, as a Base64-encoded string
  data: z.string(),
});
export type LicenseFileObject = z.infer<typeof ZLicenseFileObject>;

export const ZLicenseFileExternal = ZLicenseFileObject.omit({
  plist: true,
}).extend({
  // relative url to download the license key file
  url: z.string(),
});
export type LicenseFileExternal = z.infer<typeof ZLicenseFileExternal>;

export const ZLicenseExternal = z.object({
  id: z.string(),
  object: z.literal("licenseKey"),
  file: ZLicenseFileExternal,
});
export type LicenseExternal = z.infer<typeof ZLicenseExternal>;
