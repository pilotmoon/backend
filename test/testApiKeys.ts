import test from "ava";
import { rolo } from "./setup";

test("missing api key", async (t) => {
  const res = await rolo().get("healthcheck", {
    headers: { "Authorization": null },
  });
  t.is(res.status, 401);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});

test("bad auth key format", async (t) => {
  const res = await rolo().get("healthcheck", {
    headers: { "Authorization": "blah blah" },
  });
  t.is(res.status, 401);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});

test("unknown api key", async (t) => {
  const res = await rolo().get("healthcheck", {
    headers: { "Authorization": "Bearer blah blah" },
  });
  t.is(res.status, 401);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});

test("unknown api key, x-api-key", async (t) => {
  const res = await rolo().get("healthcheck", {
    headers: { "Authorization": null, "X-Api-Key": "blah blah" },
  });
  t.is(res.status, 401);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});

test("create api key, missing payload", async (t) => {
  const res = await rolo().post("api_keys");
  t.is(res.status, 400);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});

test("create api key, missing scopes", async (t) => {
  const res = await rolo().post("api_keys", {
    kind: "test",
  });
  t.is(res.status, 400);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});

test("create api key, unknown scopes", async (t) => {
  const res = await rolo().post("api_keys", {
    kind: "test",
    scopes: ["foo"],
  });
  t.is(res.status, 400);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});

test("create api key, wrong kind", async (t) => {
  const res = await rolo().post("api_keys", {
    kind: "live",
    scopes: [],
  });
  t.is(res.status, 403);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});

test("create api key", async (t) => {
  const res = await rolo().post("api_keys", {
    kind: "test",
    scopes: [],
  });
  t.is(res.status, 201);
  const location = res.headers["location"];
  t.assert(
    location.length > 0 &&
      location.startsWith(process.env.APP_URL),
  );
  t.log(location);

  const res2 = await rolo().get(location);
  t.is(res2.status, 200);
  t.like(res2.data, {
    kind: "test",
    scopes: [],
  });
  t.assert(res2.data.id.length > 0);
  t.assert(res2.data.key.length > 0);
});
