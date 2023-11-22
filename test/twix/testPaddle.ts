import test from "ava";
import axios, { AxiosInstance } from "axios";

let paddle: AxiosInstance;
async function setup() {
  paddle = axios.create({
    baseURL: `${process.env.TWIX_TEST_URL}/webhooks/paddle`,
    validateStatus: () => true, // don't throw on non-200 status
  });
}

const samplePaddle = {
  p_order_id: "573252",
  p_quantity: "1",
  email: "blackhole+640ce526cddee@paddle.com",
  name: "Test User",
  product: "com.example.product",
  event_time: "2023-03-11 20:31:34",
  marketing_consent: "0",
  mode: "test",
  p_country: "US",
  p_coupon: "",
  p_coupon_savings: "0",
  p_currency: "USD",
  p_custom_data: "",
  p_earnings: '{"9710":"5.0300"}',
  p_paddle_fee: "0.79",
  p_price: "5.82",
  p_product_id: "47023",
  p_sale_gross: "5.82",
  p_tax_amount: "0",
  p_used_price_override: "1",
  passthrough: "Example passthrough",
  quantity: "1",
  p_signature:
    "mAVS3H63h4zcrQ91CnfJKC/mJlK7VqzuLf0OlKUyG6prKzQjtpcASW2LjlNAN7gjCvd3LByLxRehqYXdl/6MMvYnMLFUFYnJjfdGpGorom3pbdOx1bWtN4zAYfxB4SU11HQI3ilbYAG+ffExREfc7C3PigDjwqBU+DditilySVJgZQgvytUfvu4tYEVPSTQ7FptTRC6CNO1JR8YM1fDPhBSgjXW65XMgMfebtwkthllSa1QF8wkP/2g6mliX2g1RKH8casCVRSo8zPPKrMSQHLxIuuyw8MLRGOyV4jQxFlRebASnV1WqsXiHli8/8//IpLD4nVyAlCmBddYH1Lw5AeFEK/Sg4HZ0Y3+ZSfxs/xFw80d0FAGvQBDe1R7XR4Fe9OuaaV9gkCB02i8ZZ7xH4W5tXaQMRVcuPDGOBvDXxM6NEMj9I21AUWHXRwls7h0BJHZU2Tvta87khOrQ2fMFCQ++FhUooOXLliVJGEfX02bXJc+/fTK2eG57GqRm1IjqJIcI0bniMpGTxamgokb4hnd4zBjjCyZQ4/H1Ig4ce229JkI+xKA7fdRukbgDm4KF0d4YLpM9OTBYYlmXy1WgquX+PPoug0wUFOsZwMzWg5nusYNz0lAuPJWOZaSUCLMHe2gfiqOh5zGgVrTz1c2uKyeX20aYz9jjZAITyfQUfSU=",
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
  t.is(res.status, 400);
});

test("post /generateLicense with sample body and invalid passthrough", async (t) => {
  const res = await paddle.post("/generateLicense", {
    ...samplePaddle,
    passthrough: "invalid",
  });
  t.is(res.status, 400);
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
