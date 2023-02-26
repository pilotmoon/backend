import test from "ava";
import { canonicalizeEmail } from "../../src/canonicalizeEmail";

test("test email addresses", (t) => {
  t.is(canonicalizeEmail("email@example.com"), "email@example.com");
  t.is(
    canonicalizeEmail("email.address@example.com"),
    "emailaddress@example.com",
  );
  t.is(
    canonicalizeEmail("Email.Address@example.com"),
    "emailaddress@example.com",
  );
  t.is(
    canonicalizeEmail("Email.Address+TAG@example.com"),
    "emailaddress@example.com",
  );
  t.is(
    canonicalizeEmail("Ema.il.Address+TAG+another@example.com"),
    "emailaddress@example.com",
  );
});
