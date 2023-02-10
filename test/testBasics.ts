import test from "ava";
import { rolo } from "./setup";

test("healthcheck", async (t) => {
  const res = await rolo().get("healthcheck");
  t.is(res.status, 200);
  t.like(res.data, { healthcheck: true, livemode: false });
});

test("healthcheck, query string", async (t) => {
  const res = await rolo().get("healthcheck?foo=bar");
  t.is(res.status, 200);
  t.like(res.data, { healthcheck: true, livemode: false });
});

test("healthcheck, trailing slash", async (t) => {
  const res = await rolo().get("healthcheck/");
  t.is(res.status, 200);
  t.like(res.data, { healthcheck: true, livemode: false });
});

test("healthcheck, query string, trailing slash", async (t) => {
  const res = await rolo().get("healthcheck/?foo=bar");
  t.is(res.status, 200);
  t.like(res.data, { healthcheck: true, livemode: false });
});

test("healthcheck, post (method not allowed)", async (t) => {
  const res = await rolo().post("healthcheck");
  t.is(res.status, 405);
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
