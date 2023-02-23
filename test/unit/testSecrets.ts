import {
  decryptString as decrypt,
  encryptString as encrypt,
} from "../../src/secrets";
import test from "ava";

test("encrypt and decrypt", (t) => {
  const message = "hello world";
  const encrypted = encrypt(message, "test");
  const decrypted = decrypt(encrypted, "test");
  t.is(decrypted, message);
});

test("bad key kind", (t) => {
  const message = "hello world";
  t.log(t.throws(() => encrypt(message, "foo" as any))?.message);
});

test("decrypt garbage", (t) => {
  t.log(
    t.throws(() => decrypt(Buffer.from("sdgfjhgsdfhjg"), "test"))
      ?.message,
  );
});

test("decrypt random iv + nothing", (t) => {
  t.log(
    t.throws(() =>
      decrypt(Buffer.from("12345678901234567890123456789012", "hex"), "test")
    )
      ?.message,
  );
});

test("encrypt then modify iv", (t) => {
  const message = "hello world";
  const encrypted = encrypt(message, "test");
  const modified = Buffer.concat([
    encrypted.subarray(0, 16),
    Buffer.from("12345678901234567890123456789012", "hex"),
  ]);
  t.log(t.throws(() => decrypt(modified, "test"))?.message);
});
