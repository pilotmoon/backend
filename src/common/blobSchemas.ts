import { z } from "zod";
export const ZBlobHash = z.string().regex(/^[0-9a-f]{40}$/);
export type BlobHash = z.infer<typeof ZBlobHash>;
export const ZBlobSchema = z.object({
  id: z.string(),
  object: z.literal("blob"),
  hash: ZBlobHash,
});
