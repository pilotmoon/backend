// Module to encrypt and decrypt secrets
// using the key stored in the environment variable

import {
  createCipheriv,
  createDecipheriv,
  Encoding,
  randomBytes,
} from "crypto";
import { config } from "./config";
import { KeyKind } from "./identifiers";

const marker = "#utf8#";

function getSecretKey(kind: KeyKind) {
  let hexKey;
  switch (kind) {
    case "live":
      hexKey = config.APP_SECRET_LIVE;
    case "test":
      hexKey = config.APP_SECRET_TEST;
  }
  if (!/^[0-9a-f]{64}$/.test(hexKey)) {
    throw new Error(`No secret key for kind '${kind}'`);
  }
  return hexKey;
}

export function encryptString(message: string, kind: KeyKind): string {
  const key = Buffer.from(getSecretKey(kind), "hex");
  const iv = randomBytes(16);

  const cipher = createCipheriv("aes256", key, iv);

  return iv.toString("hex") +
    cipher.update(marker, "utf8", "hex") +
    cipher.update(message, "utf8", "hex") +
    cipher.final("hex");
}

export function decryptString(encryptedMessage: string, kind: KeyKind): string {
  const key = Buffer.from(getSecretKey(kind), "hex");
  const iv = Buffer.from(encryptedMessage.slice(0, 32), "hex");
  const encryptedMessageWithoutIv = encryptedMessage.slice(32);

  const decipher = createDecipheriv("aes256", key, iv);
  const plainText = decipher.update(encryptedMessageWithoutIv, "hex", "utf8") +
    decipher.final("utf8");

  if (!plainText.startsWith(marker)) {
    throw new Error("Unable to decrypt string");
  }
  return plainText.slice(6);
}
