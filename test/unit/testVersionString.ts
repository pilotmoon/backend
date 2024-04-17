import { compareVersionStrings } from "../../src/common/versionString.js";
import test from "ava";

const testData = [
  {
    a: "1.0.0",
    b: "1.0.0",
    expected: 0,
  },
  {
    a: "1.0.0",
    b: "1.0",
    expected: 1,
  },
  {
    a: "1.0.1",
    b: "1.0.0",
    expected: 1,
  },
  {
    a: "1.0.0",
    b: "1.1.0",
    expected: -1,
  },
];

test("compareVersionStrings", (t) => {
  for (const { a, b, expected } of testData) {
    t.is(compareVersionStrings(a, b), expected);
  }
});
