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
import { AuthKind } from "./identifiers";

const marker = "#utf8#";

function getSecretKey(kind: AuthKind) {
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
// optionally set additional authenticated data (AAD)
export function encryptString(
  message: string,
  kind: AuthKind,
  associatedString?: string,
): Buffer {
  const key = getSecretKey(kind);
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (associatedString) {
    cipher.setAAD(Buffer.from(associatedString));
  }
  return Buffer.concat([
    iv,
    cipher.update(marker, "utf8"),
    cipher.update(message, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
}

// decrypt a buffer to a string using the specified key kind
export function decryptString(
  encryptedMessage: Buffer,
  kind: AuthKind,
  associatedString?: string,
): string {
  const key = getSecretKey(kind);
  // encryptedMessage consis of:
  // - 12 byte initialization vector
  // - encrypted message
  // - 16 byte authentication tag
  const iv = encryptedMessage.subarray(0, 12);
  const encryptedMessageWithoutIv = encryptedMessage.subarray(12, -16);
  const authTag = encryptedMessage.subarray(-16);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  if (associatedString) {
    decipher.setAAD(Buffer.from(associatedString));
  }
  const plainText = Buffer.concat([
    decipher.update(encryptedMessageWithoutIv),
    decipher.final(),
  ]).toString("utf8");

  if (!plainText.startsWith(marker)) {
    throw new Error("Unable to decrypt string");
  }
  return plainText.slice(marker.length);
}

// function to check if the value is a plain object
function isPlainObject(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
function shouldEncrypt(value: unknown) {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    isPlainObject(value);
}

// The encryptInPlace and decryptInPlace functions
// modify the record in place.  This is intended for encrypting
// and decrypting records as the last step immediately before inserting,
// or first step immediately after retrieving from the database.

// encrypt values in the object. only strings, numbers, booleans and
// plain objects are encrypted.
// if keys is specified, only encrypt values for those keys. otherwise,
// encrypt all values except "_id" and "object".
// the binary format has the subtype 0x81 as a marker.
// (Subtypes 0x80 to 0xFF are user defined, ehttps://bsonspec.org/spec.html)
export function encryptInPlace(
  record: Record<string, unknown> | undefined,
  kind: AuthKind,
  keys?: readonly string[],
) {
  if (!record) return;
  if (!keys) {
    keys = Object.keys(record).filter((key) =>
      key !== "_id" && key !== "object"
    );
  }
  for (const [key, value] of Object.entries(record)) {
    if (keys && !keys.includes(key)) continue;
    if (!shouldEncrypt(value)) continue;
    const string = JSON.stringify(value);
    if (string) {
      record[key] = new Binary(encryptString(string, kind), 0x81);
    }
  }
}

// decrypt all binary values in the record
export function decryptInPlace(
  record: Record<string, unknown> | undefined,
  kind: AuthKind,
) {
  if (!record) return;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (
      value instanceof Binary && value.sub_type === 0x81
    ) {
      record[key] = JSON.parse(
        decryptString(Buffer.from((record[key] as Binary).buffer), kind),
      );
    }
  }
}
