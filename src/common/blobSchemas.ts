import { z } from "zod";
export const ZBlobHash = z.string().regex(/^[0-9a-f]{40}$/);
export type BlobHash = z.infer<typeof ZBlobHash>;
