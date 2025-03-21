import test from "ava";
import axios, { AxiosInstance } from "axios";
import { getRemoteConfig } from "../../src/twix/remoteConfig.js";
import { getRolo } from "../../src/twix/rolo.js";

let webhooks: AxiosInstance;
async function setup() {
  const keys = (await getRemoteConfig("user_apikeys")).keys as any;
  const key = keys.find(
    (key: { name: string }) => key.name === "internal test",
  );

  webhooks = axios.create({
    baseURL: process.env.TWIX_URL,
    validateStatus: () => true, // don't throw on non-200 status
    headers: {
      "X-Api-Key": key.key,
    },
  });
}

test.before(setup);

test("lizhi get blank", async (t) => {
  const res = await webhooks.get("/webhooks");
  t.is(res.status, 404);
});
-test("lizhi get /generateLizense", async (t) => {
  const res = await webhooks.get("/webhooks/store/generateLicense");
  t.is(res.status, 405);
});

test("lizhi post /generateLicense bad api key", async (t) => {
  const res = await webhooks.post(
    "/webhooks/store/generateLicense",
    {},
    {
      headers: {
        "X-Api-Key": "dff",
      },
    },
  );
  t.log(res.data);
  t.is(res.status, 401);
});

test("lizhi post /generateLicense with sample body no qty", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
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
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "test",
    email: "test@example.com",
    product: "com.example.product",
    order: "123456",
    quantity: 10,
  });
  t.is(res.status, 201);
});

test("post license with sample body to /store/generateLicense", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "test",
    email: "test@example.com",
    product: "com.example.product",
    order: "789012",
  });
  t.is(res.status, 201);
});

test("post license with sample body to /store/generateLicense with 12 months validity", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "test",
    email: "test@example.com",
    product: "com.example.product",
    order: "789013",
    valid_months: 12,
  });
  t.is(res.status, 400);
  t.log(res.data);
});

test("post license with sample body to /store/generateLicense with 24 months validity", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "test",
    email: "test@example.com",
    product: "com.example.product",
    order: "789014",
    valid_months: 24,
  });
  t.is(res.status, 201);
  t.log(res.data);
});

test("quantity must be positive", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "test",
    email: "foo@foo.com",
    product: "com.example.product",
    order: "789012",
    quantity: -1,
  });
  t.is(res.status, 400);
});

test("quantity must not be zero", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "test",
    email: "foo@foo.com",
    product: "com.example.product",
    order: "789012",
    quantity: 0,
  });
  t.is(res.status, 400);
});

test("email must be valid", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "test",
    email: "foo",
    product: "com.example.product",
    order: "789012",
  });
  t.is(res.status, 400);
});

test("product must be valid", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "test",
    email: "foo@foo.com",
    product: "com.invalid.product",
    order: "789012",
  });
  t.is(res.status, 400);
});

test("webhook, store, generateLicense, missing name", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    email: "foo@foo.com",
    product: "com.example.product",
    order: "789012",
  });
  t.is(res.status, 400);
});

test("webhook, store, generateLicense, missing email", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "test",
    product: "com.example.product",
    order: "789012",
  });
  t.is(res.status, 400);
});

test("webhook, store, generateLicense, missing product", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "test",
    email: "foo@foo.com",
    order: "789012",
  });
  t.is(res.status, 400);
});

test("webhook, store, generateLicense, missing order", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "test",
    email: "foo@foo.com",
    product: "com.example.product",
  });
  t.is(res.status, 400);
});

test("webhook, store, generateLicense, empty name", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "",
    email: "foo@foo.com",
    product: "com.example.product",
    order: "789012",
  });
  t.is(res.status, 400);
});

test("webhook, store, generateLicense, quantity is string", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "test",
    email: "foo@foo.com",
    product: "com.example.product",
    order: "789012",
    quantity: "1",
  });
  t.is(res.status, 400);
});

test("webhook, store, generateLicense, quantity is NaN", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateLicense", {
    name: "test",
    email: "foo@foo.com",
    product: "com.example.product",
    order: "789012",
    quantity: NaN,
  });
  t.is(res.status, 400);
});

test("webhook, store, generateCoupon, example30", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateCoupon", {
    offer: "example30",
  });
  t.is(res.status, 201);
  t.log(res.data);
  t.assert(res.data.startsWith("TST"));
});

test("webhook, store, generateCoupon, invalid offer", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateCoupon", {
    offer: "invalid",
  });
  t.log(res.data);
  t.is(res.status, 400);
});

test("webhook, store, generateCoupon, coupon id for wrong mode", async (t) => {
  const res = await webhooks.post("/webhooks/store/generateCoupon", {
    offer: "popclip30",
  });
  t.log(res.data);
  t.is(res.status, 400);
});

test("webhook, store, getProducts, missing product", async (t) => {
  const res = await webhooks.get("/frontend/store/getProducts");
  t.is(res.status, 400);
});

test("webhook, store, getProducts, invalid product", async (t) => {
  const res = await webhooks.get(
    "/frontend/store/getProducts?products=invalid",
  );
  t.is(res.status, 400);
});

test("webhook, store, getProducts, valid product", async (t) => {
  const res = await webhooks.get(
    "/frontend/store/getProducts?products=popclip",
  );
  t.is(res.status, 200);
});
