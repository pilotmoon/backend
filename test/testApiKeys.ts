import test from "ava";
import { rolo } from "./setup";
import { randomString } from "@pilotmoon/chewit";

test("missing api key", async (t) => {
  const res = await rolo().get("health", {
    headers: { "Authorization": null },
  });
  t.is(res.status, 401);
});

test("bad auth key format", async (t) => {
  const res = await rolo().get("health", {
    headers: { "Authorization": "blah blah" },
  });
  t.is(res.status, 401);
});

test("unknown api key", async (t) => {
  const res = await rolo().get("health", {
    headers: { "Authorization": "Bearer blah blah" },
  });
  t.is(res.status, 401);
});

test("create api key, missing payload", async (t) => {
  const res = await rolo().post("api_keys", "", {
    headers: { "Content-Type": "application/json" },
  });
  t.is(res.status, 400);
  t.log(res.data.error.message);
});

test("create api key, form encoded", async (t) => {
  const res = await rolo().post(
    "api_keys",
    new URLSearchParams({ foo: "bar" }),
  );
  t.is(res.status, 415);
});

test("create api key, string", async (t) => {
  const res = await rolo().post(
    "api_keys",
    "foo",
  );
  t.is(res.status, 415);
});

test("create api key, empty object", async (t) => {
  const res = await rolo().post("api_keys", {});
  t.is(res.status, 400);
});

test("create api key, unknown scope", async (t) => {
  const res = await rolo().post("api_keys", {
    scopes: ["foo"],
  });
  t.is(res.status, 400);
});

test("api key, method not allowed (get)", async (t) => {
  const res = await rolo().get("api_keys");
  t.is(res.status, 405);
});

test("api key CRUD test", async (t) => {
  // create new key
  const res = await rolo().post("api_keys", {
    scopes: [],
    description: "crud test key",
    blah: "blah",
  });
  t.is(res.status, 201);
  t.assert(res.data.key.length > 0);
  t.is(res.data.description, "crud test key");
  t.is(res.data.blah, undefined);
  const location = res.headers["location"];
  t.assert(location.startsWith(process.env.APP_URL));
  t.log(location);

  // get the key
  const res2 = await rolo().get(location);
  t.is(res2.status, 200);
  t.like(res2.data, {
    scopes: [],
    description: "crud test key",
  });
  t.is(res2.status, 200);
  t.assert(res2.data.id.length > 0);
  t.is(res2.data.key, undefined);
  t.assert(!res2.data.scopes.includes("api_keys:read"));

  // update the key
  const res3 = await rolo().patch(location, {
    description: "crud test key updated",
  });
  t.is(res3.status, 204);
  t.is(res3.data, "");

  // get the key again to check update
  const res4 = await rolo().get(location);
  t.is(res4.status, 200);
  t.like(res4.data, {
    scopes: [],
    description: "crud test key updated",
  });
  t.is(res4.status, 200);

  // delete the key
  const res5 = await rolo().delete(location);
  t.is(res5.status, 204);
  t.is(res5.data, "");

  // get the key again
  const res6 = await rolo().get(location);
  t.is(res6.status, 404);
});

test("get current api key", async (t) => {
  const res = await rolo().get("api_keys/current");
  t.is(res.status, 200);
  t.like(res.data, {
    id: process.env.API_KEY_ID_TEST_GOOD,
    kind: "test",
  });
  t.assert(res.data.id.length > 0);
  t.is(res.data.key, undefined);
});

test("modify current api key", async (t) => {
  const res = await rolo().patch("api_keys/current", { "description": "foo" });
  t.is(res.status, 405);
});

test("delete current api key", async (t) => {
  const res = await rolo().delete("api_keys/current");
  t.is(res.status, 405);
});

test("options current api key", async (t) => {
  const res = await rolo().options("api_keys/current");
  t.is(res.status, 200);
  const allow = res.headers["allow"].split(", ").sort();
  t.deepEqual(allow, ["GET", "HEAD"]);
});

test("options current api key by id", async (t) => {
  const res = await rolo().options(
    "api_keys/" + process.env.API_KEY_ID_TEST_GOOD,
  );
  t.is(res.status, 200);
  const allow = res.headers["allow"].split(", ").sort();
  t.deepEqual(allow, ["DELETE", "GET", "HEAD", "PATCH"]);
});

test("delete current api key by id", async (t) => {
  const res = await rolo().delete(
    "api_keys/" + process.env.API_KEY_ID_TEST_GOOD,
  );
  t.is(res.status, 400);
});

test("modify current api key by id", async (t) => {
  const res = await rolo().patch(
    "api_keys/" + process.env.API_KEY_ID_TEST_GOOD,
    { "description": "foo" },
  );
  t.is(res.status, 400);
});

test("modify other api key by id", async (t) => {
  const str = "random " + randomString({ length: 10 });
  const res = await rolo().patch(
    "api_keys/" + process.env.API_KEY_ID_TEST_NO_SCOPES,
    { "description": str },
  );
  t.is(res.status, 204);
});
