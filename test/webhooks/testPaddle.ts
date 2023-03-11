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
  email: "blackhole+640cdd5197baf@paddle.com",
  event_time: "2023-03-11 19:58:09",
  marketing_consent: "0",
  name: "Test User",
  p_country: "US",
  p_coupon: "",
  p_coupon_savings: "0",
  p_currency: "USD",
  p_custom_data: "",
  p_earnings: '{"9710":"14.0200"}',
  p_order_id: "573239",
  p_paddle_fee: "1.26",
  p_price: "15.28",
  p_product_id: "47023",
  p_quantity: "1",
  p_sale_gross: "15.28",
  p_tax_amount: "0",
  p_used_price_override: "1",
  passthrough: "Example passthrough",
  product: "com.example.product",
  quantity: "1",
  p_signature:
    "UIWGXJsxIvfKlqRDZXTBzmtl0z+iVApe8VVBKaAvPwGlu/6aJMwo2IxWs1IYS3/KtLXJ5RwCWSKAaHGghzx4eOf1NcivTVC2hHCDKCCEaCyw6DEtVPbgd/8nAeQ8KoLm+FukJA5Utid340QCYurzGsFHoBOo2rxZVNTuWaFyGJ43R7zH0KaLHfacaMVbqg5Ev7Y1w/vR8geP/ovzWGvdFcFT7kiLfOlgVlSKAuzm0nNkV0vWsqpVFWC2f6XIL8x5DSmsUSSqxKbcxOJg4LGD5ZJ4MT/s6wXABYxI/TXSPeHhyNTMyRUQRPWm/XX9xDvMx1ADjFIel9/+MOoncxlG+VRTLSMNvpcSR6Z4xfBRt3rhTjCesmIoGRhlgOy53bW/BEP297Rfl75lmNBnvUOf6M881ro+dX6HzhfiWN6UFMd4T9QQkcrXjiq4MysxLmTulgY/qnuMle7I5fAHJnV/jjKueBLqSmk9JGA2N56YyHWmLWMiWi46aRTBb0+cQxzEVX9MrebiJX2iCuUTK4BiO2mdxnDxisnGE2eJJ6cpyC0sw4s3GgvQ+O2lpCOX5G8uxpQ1C9CALV6woCEmuHhACoo9xp2AeWJ4DmkVO2U3k8Cs47veWjfEY3auL3pBzt1pTmv1PQIfJQWdF7vVoEUDEbV930sBVfmax/OUQv5Im70=",
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
