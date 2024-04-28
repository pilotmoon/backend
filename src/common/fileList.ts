import { z } from "zod";
import { NonNegativeSafeInteger } from "./saneSchemas.js";

export const ZBlobFileListEntry = z.object({
  path: z.string(),
  hash: z.string(),
  size: NonNegativeSafeInteger,
  executable: z.boolean().optional(),
});

export const ZBlobFileList = z.array(ZBlobFileListEntry);
export type BlobFileList = z.infer<typeof ZBlobFileList>;
