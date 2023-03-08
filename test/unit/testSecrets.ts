import {
  decrypt,
  decryptInPlace,
  encrypt,
  encryptInPlace,
} from "../../src/api/secrets";
import test from "ava";
import { Binary } from "mongodb";
import { AuthKind } from "../../src/api/auth";

// string wrappers for encrypt and decrypt
export function encryptString(
  message: string,
  kind: AuthKind,
  associatedString?: string,
): Uint8Array {
  const associatedData = associatedString
    ? Buffer.from(associatedString)
    : undefined;
  return encrypt(Buffer.from(message), kind, associatedData);
}

export function decryptString(
  encryptedMessage: Uint8Array,
  kind: AuthKind,
  associatedString?: string,
): string {
  const associatedData = associatedString
    ? Buffer.from(associatedString)
    : undefined;
  return Buffer.from(decrypt(encryptedMessage, kind, associatedData)).toString(
    "utf8",
  );
}

test("encrypt and decrypt", (t) => {
  const message = "hello world";
  const encrypted = encryptString(message, "test");
  const decrypted = decryptString(encrypted, "test");
  t.is(decrypted, message);
});

test("encrypt and decrypt with aad", (t) => {
  const message = "hello world";
  const aad = "foo";
  const encrypted = encryptString(message, "test", aad);
  const decrypted = decryptString(encrypted, "test", aad);
  t.is(decrypted, message);
});

test("encrypt and decrypt with bad aad", (t) => {
  const message = "hello world";
  const aad = "foo";
  const encrypted = encryptString(message, "test", aad);
  t.log(
    t.throws(() => decryptString(encrypted, "test", "bar"))?.message,
  );
});

test("encrypt and decrypt with missing aad", (t) => {
  const message = "hello world";
  const aad = "foo";
  const encrypted = encryptString(message, "test", aad);
  t.log(
    t.throws(() => decryptString(encrypted, "test"))?.message,
  );
});

test("bad key kind", (t) => {
  const message = "hello world";
  t.log(t.throws(() => encryptString(message, "foo" as any))?.message);
});

test("decrypt garbage", (t) => {
  t.log(
    t.throws(() => decryptString(Buffer.from("sdgfjhgsdfhjg"), "test"))
      ?.message,
  );
});

test("decrypt random iv + nothing", (t) => {
  t.log(
    t.throws(() =>
      decryptString(
        Buffer.from("12345678901234567890123456789012", "hex"),
        "test",
      )
    )
      ?.message,
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
  encryptInPlace(record, "test", ["encrypted"]);

  // verify that the encrypted value is different
  t.notDeepEqual(record, original);
  t.assert(record.encrypted instanceof Binary);

  // verify that the non-encrypted keys didn't change
  t.like(record, { foo: "bar", baz: "qux" });

  // verify that the encrypted value is decrypted correctly
  decryptInPlace(record, "test");
  t.deepEqual(record, original);
});
