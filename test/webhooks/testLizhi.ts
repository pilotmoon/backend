import test from "ava";
import axios, { AxiosInstance } from "axios";

let paddle: AxiosInstance;
async function setup() {
  const keys = JSON.parse(process.env.LIZHI_APIKEYS ?? "");
  const key = keys.find((key: any) => key.name === "internal test");

  paddle = axios.create({
    baseURL: process.env.TWIX_TEST_URL + "/webhooks/lizhi",
    validateStatus: () => true, // don't throw on non-200 status
    headers: {
      "X-Api-Key": key.key,
    },
  });
}

test.before(setup);

test("lizhi get blank", async (t) => {
  const res = await paddle.get("");
  t.is(res.status, 404);
});

test("lizhi get /generateLizense", async (t) => {
  const res = await paddle.get("/generateLicense");
  t.is(res.status, 405);
});

test("lizhi post /generateLicense no api key", async (t) => {
  const res = await paddle.post("/generateLicense", {}, {
    headers: {
      "X-Api-Key": "dff",
    },
  });
  t.log(res.data);
  t.is(res.status, 401);
});

test("lizhi post /generateLicense with sample body no qty", async (t) => {
  const res = await paddle.post("/generateLicense", {
    name: "test",
    email: "test@example.com",
    product: "com.example.product",
    order: "123456",
  });
  t.is(res.status, 201);
  // parse url from the returned markdown link
  t.log(res.data);
  t.assert(
    res.data.web_url.startsWith("https://api.pilotmoon.com/v2"),
    "link prefix",
  );
  t.is(res.data.file_name, "test.examplelicense");
});

test("lizhi post /generateLicense with sample body with qty", async (t) => {
  const res = await paddle.post("/generateLicense", {
    name: "test",
    email: "test@example.com",
    product: "com.example.product",
    order: "123456",
    quantity: 10,
  });
  t.is(res.status, 201);
  // parse url from the returned markdown link
  t.assert(
    res.data.web_url.startsWith("https://api.pilotmoon.com/v2"),
    "link prefix",
  );
  t.is(res.data.file_name, "test.examplelicense");
});
