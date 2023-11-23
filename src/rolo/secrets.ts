// Module to encrypt and decrypt secrets using a 32-buye key.
// The binary format of the encrypted string is
// the initialization vector (16 bytes) followed
// by the encrypted message.
// The encrypted message is prefixed with the
// string "#utf8#" as a marker.
// The key is a 32 byte (256 bit) hex string.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { decodeFirstSync, encode } from "cbor";
import { Binary } from "mongodb";
import { logw } from "../logger.js";
import { ApiError } from "../errors.js";

// called externally to set an encryption key
let secretKey: Buffer | undefined;
export function setSecretKey(key: string) {
  if (/^[0-9a-f]{64}$/.test(key)) {
    secretKey = Buffer.from(key, "hex");
  } else {
    throw new Error("Invalid encryption key");
  }
}

// called internally to get the encryption key
// if no key is set, use a dummy key and log a warning
// (dummy key is used for testing)
const dummyKey = Buffer.alloc(32);
function getSecretKey() {
  if (secretKey) {
    return secretKey;
  } else {
    logw("Using dummy encryption key");
    return dummyKey;
  }
}

// encrypt a string to a buffer using the specified key kind
// optionally set additional authenticated data (AAD)
export function encrypt(
  message: Uint8Array,
  associatedData?: Uint8Array,
): Uint8Array {
  const key = getSecretKey();
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (associatedData) {
    cipher.setAAD(associatedData);
  }
  return Buffer.concat([
    iv,
    cipher.update(message),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
}

// decrypt a buffer to a string using the specified key kind
export function decrypt(
  encryptedMessage: Uint8Array,
  associatedData?: Uint8Array,
): Uint8Array {
  const key = getSecretKey();
  // encryptedMessage consis of:
  // - 12 byte initialization vector
  // - encrypted message
  // - 16 byte authentication tag
  const iv = encryptedMessage.subarray(0, 12);
  const encryptedMessageWithoutIv = encryptedMessage.subarray(12, -16);
  const authTag = encryptedMessage.subarray(-16);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  if (associatedData) {
    decipher.setAAD(associatedData);
  }
  return Buffer.concat([
    decipher.update(encryptedMessageWithoutIv),
    decipher.final(),
  ]);
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
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    isPlainObject(value)
  );
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
  keys?: readonly string[],
) {
  if (!record) return;
  const keysToEncrypt =
    keys ??
    Object.keys(record).filter((key) => key !== "_id" && key !== "object");
  for (const [key, value] of Object.entries(record)) {
    if (!keysToEncrypt.includes(key)) continue;
    if (!shouldEncrypt(value)) continue;
    record[key] = new Binary(encrypt(encode(value)), 0x81);
  }
}

// decrypt all binary values in the record
export function decryptInPlace(record: Record<string, unknown> | undefined) {
  if (!record) return;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (value instanceof Binary && value.sub_type === 0x81) {
      try {
        record[key] = decodeFirstSync(decrypt((record[key] as Binary).buffer));
      } catch (error) {
        throw new Error(`Error decrypting '${key}'`);
      }
    }
  }
}
