// Module to encrypt and decrypt secrets
// using the key stored in the environment variable.
// Also provices support for validating mongodb Binary objects.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { Binary } from "mongodb";
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
  return Buffer.from(hexKey, "hex");
}

export function encrypt(message: string, kind: KeyKind): Buffer {
  const key = getSecretKey(kind);
  const iv = randomBytes(16);

  const cipher = createCipheriv("aes256", key, iv);

  return Buffer.concat([
    iv,
    cipher.update(marker, "utf8"),
    cipher.update(message, "utf8"),
    cipher.final(),
  ]);
}

export function decrypt(encryptedMessage: Buffer, kind: KeyKind): string {
  const key = getSecretKey(kind);
  const iv = encryptedMessage.subarray(0, 16);
  const encryptedMessageWithoutIv = encryptedMessage.subarray(16);

  const decipher = createDecipheriv("aes256", key, iv);
  const plainText = Buffer.concat([
    decipher.update(encryptedMessageWithoutIv),
    decipher.final(),
  ]).toString("utf8");

  if (!plainText.startsWith(marker)) {
    throw new Error("Unable to decrypt string");
  }
  return plainText.slice(marker.length);
}

// replace the given keys with encrypted binary values
// suitable for storing in the database.
export function encryptRecord<
  T extends Record<string, unknown>,
  K extends keyof T,
>(record: T, keys: readonly K[], kind: KeyKind) {
  const result = { ...record } as Record<K | string, unknown>;
  for (const key of keys) {
    if (key in record) {
      result[key] = new Binary(
        encrypt(JSON.stringify(record[key]), kind),
      );
    }
  }
  return result;
}

// replace the given keys with decrypted values
// suitable for use in the application.
export function decryptRecord<
  T extends Record<string, unknown>,
  K extends keyof T,
>(record: T, keys: readonly K[], kind: KeyKind) {
  const result = { ...record } as Record<K | string, unknown>;
  for (const key of keys) {
    if (key in record) {
      result[key] = JSON.parse(
        decrypt(Buffer.from((record[key] as Binary).buffer), kind),
      );
    }
  }
  return result;
}
