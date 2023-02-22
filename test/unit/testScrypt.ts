import { hashPassword, verifyPassword } from "../../src/scrypt";
import test from "ava";

test("hash and verify", async (t) => {
  const password = "hello world";
  const hash = await hashPassword(password);
  t.true(await verifyPassword(hash, password));
});

test("verify bad password", async (t) => {
  const password = "hello world";
  const hash = await hashPassword(password);
  t.false(await verifyPassword(hash, "bad password"));
});

test("verify garbage hash", async (t) => {
  t.false(await verifyPassword(Buffer.from("fsdfd"), "bad password"));
});
