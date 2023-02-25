import test from "ava";
import { rolo } from "./setup";
import { faker } from "@faker-js/faker";

test("create license key, missing payload", async (t) => {
  const res = await rolo().post("licenseKeys", "");
  t.is(res.status, 400);
});

test("create license key, no scope", async (t) => {
  const res = await rolo("noscope").post("licenseKeys", {
    product: "product",
    name: "name",
  });
  t.is(res.status, 403);
});

test("create license key, missing product", async (t) => {
  const res = await rolo().post("licenseKeys", {
    name: "name",
  });
  t.is(res.status, 400);
});

test("create license key, missing name", async (t) => {
  const res = await rolo().post("licenseKeys", {
    product: "product",
  });
  t.is(res.status, 400);
});

test("create license key", async (t) => {
  const res = await rolo().post("licenseKeys", {
    product: "product",
    name: "name",
  });
  t.is(res.status, 201);
  t.like(res.data, {
    product: "product",
    name: "name",
  });
  t.is(res.headers.location, `/licenseKeys/${res.data.id}`);
});

test("create license key, with email, date, order and quantity fields", async (t) => {
  faker.locale = "ru";
  const res = await rolo().post("licenseKeys", {
    product: "com.example.product",
    name: faker.name.fullName(),
    email: faker.internet.email(),
    order: "111111-222222",
    quantity: 1,
  });
  t.is(res.status, 201);
  t.is(res.headers.location, `/licenseKeys/${res.data.id}`);
});
