import test from "ava";
import { Binary } from "mongodb";
import { AuthKind } from "../../src/api/auth.js";
import {
  decrypt,
  decryptInPlace,
  encrypt,
  encryptInPlace,
} from "../../src/api/secrets.js";

// string wrappers for encrypt and decrypt
export function encryptString(
  message: string,
  associatedString?: string,
): Uint8Array {
  const associatedData = associatedString
    ? Buffer.from(associatedString)
    : undefined;
  return encrypt(Buffer.from(message), associatedData);
}

export function decryptString(
  encryptedMessage: Uint8Array,
  associatedString?: string,
): string {
  const associatedData = associatedString
    ? Buffer.from(associatedString)
    : undefined;
  return Buffer.from(decrypt(encryptedMessage, associatedData)).toString(
    "utf8",
  );
}

test("encrypt and decrypt", (t) => {
  const message = "hello world";
  const encrypted = encryptString(message);
  const decrypted = decryptString(encrypted);
  t.is(decrypted, message);
});

test("encrypt and decrypt with aad", (t) => {
  const message = "hello world";
  const aad = "foo";
  const encrypted = encryptString(message, aad);
  const decrypted = decryptString(encrypted, aad);
  t.is(decrypted, message);
});

test("encrypt and decrypt with bad aad", (t) => {
  const message = "hello world";
  const aad = "foo";
  const encrypted = encryptString(message, aad);
  t.log(t.throws(() => decryptString(encrypted, "bar"))?.message);
});

test("encrypt and decrypt with missing aad", (t) => {
  const message = "hello world";
  const aad = "foo";
  const encrypted = encryptString(message, aad);
  t.log(t.throws(() => decryptString(encrypted))?.message);
});

test("decrypt garbage", (t) => {
  t.log(t.throws(() => decryptString(Buffer.from("sdgfjhgsdfhjg")))?.message);
});

test("decrypt random iv + nothing", (t) => {
  t.log(
    t.throws(() =>
      decryptString(Buffer.from("12345678901234567890123456789012", "hex")),
    )?.message,
  );
});

test("encrypt then modify iv", (t) => {
  const message = "hello world";
  const encrypted = encryptString(message, "test");
  const modified = Buffer.concat([
    encrypted.subarray(0, 16),
    Buffer.from("12345678901234567890123456789012", "hex"),
  ]);
  t.log(t.throws(() => decryptString(modified, "test"))?.message);
});

test("encrypt and decrypt record in place", (t) => {
  const record = {
    foo: "bar",
    baz: "qux",
    encrypted: { message: "hello world" },
  };
  const original = { ...record };
  // encrypt the record
  encryptInPlace(record, ["encrypted"]);

  // verify that the encrypted value is different
  t.notDeepEqual(record, original);
  t.assert(record.encrypted instanceof Binary);

  // verify that the non-encrypted keys didn't change
  t.like(record, { foo: "bar", baz: "qux" });

  // verify that the encrypted value is decrypted correctly
  decryptInPlace(record);
  t.deepEqual(record, original);
});
