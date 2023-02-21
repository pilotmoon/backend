import { decryptString, encryptString } from "../../src/secrets";
import test from "ava";

test("encrypt and decrypt", (t) => {
  const message = "hello world";
  const encrypted = encryptString(message, "test");
  const decrypted = decryptString(encrypted, "test");
  t.is(decrypted, message);
});
