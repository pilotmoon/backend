import { createHash } from "node:crypto";

// simple sha256 wrapper that generates a hex string
export function sha256Hex(message: string) {
  return createHash("sha256").update(message).digest("hex");
}
