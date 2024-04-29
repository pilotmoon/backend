import { z } from "zod";
import { NonNegativeSafeInteger } from "./saneSchemas.js";

export const ZCoreFileListEntry = z.object({
  path: z.string(),
  size: NonNegativeSafeInteger,
  executable: z.boolean(),
});

export const ZCoreFileList = z.array(ZCoreFileListEntry);
export type CoreFileList = z.infer<typeof ZCoreFileList>;
