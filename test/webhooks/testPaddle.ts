import test from "ava";
import axios, { AxiosInstance } from "axios";

let paddle: AxiosInstance;
async function setup() {
  paddle = axios.create({
    baseURL: process.env.TWIX_TEST_URL + "/webhooks/paddle",
    validateStatus: () => true, // don't throw on non-200 status
  });
}

const samplePaddle = {
  name: "Test User",
  quantity: "1",
  marketing_consent: "0",
  p_custom_data: "",
  email: "blackhole+640a15b78705d@paddle.com",
  p_paddle_fee: "1.35",
  p_earnings: '{"9710":"15.6400"}',
  p_quantity: "1",
  p_used_price_override: "1",
  p_sale_gross: "16.99",
  p_currency: "USD",
  p_coupon_savings: "0",
  event_time: "2023-03-09 17:21:59",
  p_signature:
    "MH2fZXagiuiXWa4wPyf2r2kI/EFIj25OYge+b2OyxHbKKdf3fq30jLkvF7ndgrbGleJp3OF+4j/PEqt7TWDVx6nAT1vnH9RqGjGLDCLahtr1wPiFEun2skE02RqhUnsP6x/q8ZXx9weuoJxpiPhdpyVjh2S9IOyrxY2Q23kmpoPZWWGwLsetNQ9FVIY2tfYfvEEpCcpGVek4Mha1jPa9zmAOO+h9fcjg7t5zTWMXrg+YHzZFeGCn5CjOKkti8WEnlklr6pP1PFxCWIT0Hk2gAg+3zTY+HU1Cozks1bnz07TBXuh8fHGY1TnrpUSbq338IhEJREH5LDS/mt4KoWC1DgedG7bEjE2bAnFhDIWcg82rwHI7Ld+n5Oy5N/bdpJQgbWgSl2ckSJRxvbrpCXeBD472E5A4/0ArG2DmeU16wv8RJMrGO4a2StSyaiKv+uPiLS/wb1z+Xr7uJ3ajBxnqK329tbMxyGtpYprNHf5ZMV9JIw6LiCy25TuwOvTH0WKmIt/nnQElGxzY51uqEyiAwVo3RTB+3AygrZhxOSt5U2BTq8nAYK9fwfHjZrOEHJFP/u8lIjB6us26MpHisFh2Kh8zKL6SakefY09WxqH2eOOZgMPCzjhZCa68oW9pIGsJQQwUeuStry+lp1UTlwmsYhRdg7Cs47iWM13VKcc5omM=",
  p_country: "US",
  p_price: "16.99",
  p_order_id: "572168",
  p_coupon: "",
  passthrough: "Example passthrough",
  p_product_id: "41687",
  p_tax_amount: "0",
  product: "com.pilotmoon.popclip",
};

test.before(setup);

test("get blank", async (t) => {
  const res = await paddle.get("");
  t.is(res.status, 404);
});

test("get /generateLicense", async (t) => {
  const res = await paddle.get("/generateLicense");
  t.is(res.status, 405);
});

test("post /generateLicense no body", async (t) => {
  const res = await paddle.post("/generateLicense");
  t.log(res.data);
  t.is(res.status, 400);
});

test("post /generateLicense with sample body and invalid signature", async (t) => {
  const res = await paddle.post("/generateLicense", {
    ...samplePaddle,
    p_signature: "invalid",
  });
  t.is(res.status, 403);
});

test("post /generateLicense with sample body and invalid passthrough", async (t) => {
  const res = await paddle.post("/generateLicense", {
    ...samplePaddle,
    passthrough: "invalid",
  });
  t.is(res.status, 403);
});

test("post /generateLicense with sample body", async (t) => {
  const res = await paddle.post("/generateLicense", samplePaddle);
  t.is(res.status, 200);
  // parse url from the returned markdown link
  t.log(res.data);
  t.is(typeof res.data, "string");
  const url = res.data.match(/\(([^)]+)\)/)[1];
  t.log(url);
  t.assert(url.startsWith("https://api.pilotmoon.com/v2"), "link prefix");
});
