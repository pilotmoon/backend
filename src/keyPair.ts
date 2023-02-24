import { z } from "zod";

// zod schema for a portable key pair
export const ZPortableKeyPair = z.object({
  object: z.literal("keyPair"),
  publicKey: z.string(),
  privateKey: z.string(),
  keyFormat: z.enum(["hex", "base64"]),
});
export type PortableKeyPair = z.infer<typeof ZPortableKeyPair>;

// a standardized format for importing/exporting a key pair
// export type PortableKeyPair = {
//   publicKey: string;
//   privateKey: string;
//   keyFormat: "hex" | "base64";
// };

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
