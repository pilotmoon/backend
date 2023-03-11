import test0, { TestFn } from "ava";
import axios, { AxiosInstance } from "axios";

const test = test0 as TestFn<{
  twix: AxiosInstance;
}>;

test.before(async (t) => {
  t.context.twix = axios.create({
    baseURL: process.env.TWIX_TEST_URL,
    headers: {
      "Content-Type": "application/json",
    },
    validateStatus: () => true,
  });
});

test("Hello", async (t) => {
  t.log(t.context.twix.defaults.baseURL);
  const { data } = await t.context.twix.get("/");
  t.log(data);
  t.assert(typeof data === "string" && data.startsWith("twix "));
});
