// Module to encrypt and decrypt secrets
// using the key stored in the environment variable.
// The binary format of the encrypted string is
// the initialization vector (16 bytes) followed
// by the encrypted message.
// The encrypted message is prefixed with the
// string "#utf8#" as a marker.
// The key is stored in the environment variable
// APP_SECRET_LIVE or APP_SECRET_TEST depending
// on the key kind.
// The key is a 32 byte (256 bit) hex string.

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

// encrypt a string to a buffer using the specified key kind
export function encryptString(message: string, kind: KeyKind): Buffer {
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

// decrypt a buffer to a string using the specified key kind
export function decryptString(encryptedMessage: Buffer, kind: KeyKind): string {
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

// The encryptInPlace and decryptInPlace functions
// modify the record in place.  This is intended for encrypting
// and decrypting records as the last step immediately before inserting,
// or first step immediately after retrieving from the database.
// The operations are not type-safe, since the values are modified
// in place so the modifications are not reflected in the type system.
// The caller must ensure that the requested values are JSON
// serializable. If the keys are not present in the record, then
// they are ignored.
// The MongoDB Binary type is used to store the encrypted values
// since it will be stored directly in the database.

// encrypt the values for the specified keys in the record, ready for storage.
// if the keys are not specified, then all values are encrypted.
export function encryptInPlace(
  record: Record<string, unknown> | undefined,
  kind: KeyKind,
  keys?: string[],
) {
  if (!record) return;
  for (const key of keys ? keys : Object.keys(record)) {
    if (key in record) {
      record[key] = new Binary(
        encryptString(JSON.stringify(record[key]), kind),
      );
    }
  }
}

// decrypt the values of the specified keys in the record ready for use.
// if the keys are not specified, then all binary keys are decrypted.
export function decryptInPlace(
  record: Record<string, unknown> | undefined,
  kind: KeyKind,
  keys?: string[],
) {
  if (!record) return;
  for (const key of keys ? keys : Object.keys(record)) {
    if (key in record && record[key] instanceof Binary) {
      record[key] = JSON.parse(
        decryptString(Buffer.from((record[key] as Binary).buffer), kind),
      );
    }
  }
}
