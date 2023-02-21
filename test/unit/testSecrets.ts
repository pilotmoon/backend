import { decryptString, encryptString } from "../../src/secrets";
import test from "ava";

test("encrypt and decrypt", (t) => {
  const message = "hello world";
  const encrypted = encryptString(message, "test");
  const decrypted = decryptString(encrypted, "test");
  t.is(decrypted, message);
});

test("bad key kind", (t) => {
  const message = "hello world";
  t.log(t.throws(() => encryptString(message, "foo" as any))?.message);
});

test("decrypt garbage", (t) => {
  t.log(t.throws(() => decryptString("dsfkjsdhjfhdskjhfkj", "test"))?.message);
});

test("decrypt random iv + nothing", (t) => {
  t.log(
    t.throws(() => decryptString("12345678901234567890123456789012", "test"))
      ?.message,
  );
});

test("encrypt then modify iv", (t) => {
  const message = "hello world";
  const encrypted = encryptString(message, "test");
  const modified = encrypted.slice(0, 32) + "12345678901234567890123456789012";
  t.log(t.throws(() => decryptString(modified, "test"))?.message);
});
