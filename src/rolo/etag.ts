import { alphabets, baseEncode } from "@pilotmoon/chewit";
import { sha256Hex } from "./sha256.js";

export function etag(message: string) {
  return baseEncode(
    [...Buffer.from(sha256Hex(message), "hex")],
    alphabets.base32Crockford,
    {
      trim: false,
    },
  )
    .slice(-20)
    .toLowerCase();
}
