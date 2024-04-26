import { createHash } from "node:crypto";
import { z } from "zod";
export const ZBlobHash = z.string().regex(/^[0-9a-f]{40}$/);
export type BlobHash = z.infer<typeof ZBlobHash>;
export const ZBlobSchema = z.object({
  id: z.string(),
  object: z.literal("blob"),
  hash: ZBlobHash,
});

export function gitHash(data: Buffer) {
  const header = `blob ${data.length}\0`;
  const buffer = Buffer.concat([Buffer.from(header), data]);
  return createHash("sha1").update(buffer).digest("hex");
}
