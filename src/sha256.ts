import { createHash } from "node:crypto";

// simple sha256 wrapper that generates a hex string
export function sha256Hex(message: string) {
  return createHash("sha256").update(message).digest("hex");
}

// simple sha256 wrapper that generates a base64url string
export function sha256Base64Url(message: string) {
  return createHash("sha256").update(message).digest("base64url");
}
