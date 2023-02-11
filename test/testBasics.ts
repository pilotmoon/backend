import test from "ava";
import { rolo } from "./setup";

test("health", async (t) => {
  const res = await rolo().get("health");
  t.is(res.status, 200);
  t.like(res.data, { object: "health", livemode: false });
});

test("health, query string", async (t) => {
  const res = await rolo().get("health?foo=bar");
  t.is(res.status, 200);
  t.like(res.data, { object: "health", livemode: false });
});

test("health, trailing slash", async (t) => {
  const res = await rolo().get("health/");
  t.is(res.status, 200);
  t.like(res.data, { object: "health", livemode: false });
});

test("health, query string, trailing slash", async (t) => {
  const res = await rolo().get("health/?foo=bar");
  t.is(res.status, 200);
  t.like(res.data, { object: "health", livemode: false });
});

test("not found", async (t) => {
  const res = await rolo().get("not-found");
  t.is(res.status, 404);
});

test("not found, root", async (t) => {
  const res = await rolo().get("");
  t.is(res.status, 404);
});

test("not found, root, trailing slash", async (t) => {
  const res = await rolo().get("/");
  t.is(res.status, 404);
});
