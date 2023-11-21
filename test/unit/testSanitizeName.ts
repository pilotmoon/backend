import test from "ava";
import { sanitizeName } from "../../src/sanitizeName.js";

test("sanitizeName", (t) => {
  t.is(sanitizeName("John Doe"), "John_Doe");
  t.is(sanitizeName("E O'C"), "E_O_C");
  t.is(sanitizeName("帅 彭"), "帅_彭");
  t.is(sanitizeName(""), "");
  t.is(sanitizeName("", "Fallback"), "Fallback");
  t.is(sanitizeName("___.", "Fallback"), "Fallback");
  t.is(sanitizeName("123-.HF", "Fallback"), "123_HF");
});
