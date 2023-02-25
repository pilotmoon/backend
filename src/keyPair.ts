import { z } from "zod";

// zod schema for a portable key pair
export const ZPortableKeyPair = z.object({
  object: z.literal("keyPair"),
  secret: z.literal(true),
  publicKey: z.string().max(1024),
  privateKey: z.string().max(1024),
  keyFormat: z.enum(["hex", "base64"]),
  description: z.string().optional(),
});
export type PortableKeyPair = z.infer<typeof ZPortableKeyPair>;

// internal representation of a key pair
export type KeyPair = {
  publicKey: Buffer;
  privateKey: Buffer;
};

// import a key pair from a portable format
export function importKeyPair(portable: PortableKeyPair): KeyPair {
  return {
    publicKey: Buffer.from(portable.publicKey, portable.keyFormat),
    privateKey: Buffer.from(portable.privateKey, portable.keyFormat),
  };
}
