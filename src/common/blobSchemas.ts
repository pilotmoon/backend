import { createHash } from "node:crypto";
import { z } from "zod";
import { NonNegativeSafeInteger } from "./saneSchemas.js";
import { alphabets, baseEncode } from "@pilotmoon/chewit";
export const ZBlobHash = z.string().regex(/^[0-9a-f]{40}$/);
export type BlobHash = z.infer<typeof ZBlobHash>;
export const ZBlobHash2 = z.string().regex(/^[0-9a-f]{64}$/);
export type BlobHash2 = z.infer<typeof ZBlobHash2>;
export const ZBlobSchema = z.object({
  id: z.string(),
  object: z.literal("blob"),
  h1: ZBlobHash,
  h2: ZBlobHash2,
  size: NonNegativeSafeInteger,
});

export function gitHash(data: Buffer, algorithm: "sha1" | "sha256" = "sha1") {
  const header = `blob ${data.length}\0`;
  const buffer = Buffer.concat([Buffer.from(header), data]);
  return createHash(algorithm).update(buffer).digest();
}

export function truncatedHash(digest: Buffer) {
  // we use the last 20 characters of the base58 encoded hash as the unique identifier
  return baseEncode([...digest], alphabets.base58Flickr, {
    trim: false,
  }).slice(-20);
}
