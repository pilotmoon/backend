"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const setup_1 = require("./setup");
const chewit_1 = require("@pilotmoon/chewit");
(0, ava_1.default)("missing api key", async (t) => {
  const res = await (0, setup_1.rolo)().get("health", {
    headers: { "Authorization": null },
  });
  t.is(res.status, 401);
});
(0, ava_1.default)("bad auth key format", async (t) => {
  const res = await (0, setup_1.rolo)().get("health", {
    headers: { "Authorization": "blah blah" },
  });
  t.is(res.status, 401);
});
(0, ava_1.default)("unknown api key", async (t) => {
  const res = await (0, setup_1.rolo)().get("health", {
    headers: { "Authorization": "Bearer blah blah" },
  });
  t.is(res.status, 401);
});
(0, ava_1.default)("create api key, missing payload", async (t) => {
  const res = await (0, setup_1.rolo)().post("api_keys", "", {
    headers: { "Content-Type": "application/json" },
  });
  t.is(res.status, 400);
  t.log(res.data.error.message);
});
(0, ava_1.default)("create api key, form encoded", async (t) => {
  const res = await (0, setup_1.rolo)().post(
    "api_keys",
    new URLSearchParams({ foo: "bar" }),
  );
  t.is(res.status, 415);
});
(0, ava_1.default)("create api key, string", async (t) => {
  const res = await (0, setup_1.rolo)().post("api_keys", "foo");
  t.is(res.status, 415);
});
(0, ava_1.default)("create api key, empty object", async (t) => {
  const res = await (0, setup_1.rolo)().post("api_keys", {});
  t.is(res.status, 400);
});
(0, ava_1.default)("create api key, unknown scope", async (t) => {
  const res = await (0, setup_1.rolo)().post("api_keys", {
    scopes: ["foo"],
  });
  t.is(res.status, 400);
});
(0, ava_1.default)("api key, method not allowed (get)", async (t) => {
  const res = await (0, setup_1.rolo)().get("api_keys");
  t.is(res.status, 405);
});
(0, ava_1.default)("api key CRUD test", async (t) => {
  // create new key
  const res = await (0, setup_1.rolo)().post("api_keys", {
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
  const res2 = await (0, setup_1.rolo)().get(location);
  t.is(res2.status, 200);
  t.like(res2.data, {
    kind: "test",
    scopes: [],
  });
  t.is(res2.status, 200);
  t.assert(res2.data.id.length > 0);
  t.is(res2.data.key, undefined);
  t.assert(!res2.data.scopes.includes("api_keys:read"));
  // update the key
  const res3 = await (0, setup_1.rolo)().patch(location, {
    scopes: ["api_keys:read"],
  });
  t.is(res3.status, 200);
  t.assert(res2.data.id.length > 0);
  t.is(res2.data.key, undefined);
  t.assert(res3.data.scopes.includes("api_keys:read"));
  // delete the key
  const res4 = await (0, setup_1.rolo)().delete(location);
  t.is(res4.status, 204);
  t.is(res4.data, "");
  // get the key again
  const res5 = await (0, setup_1.rolo)().get(location);
  t.is(res5.status, 404);
});
(0, ava_1.default)("get current api key", async (t) => {
  const res = await (0, setup_1.rolo)().get("api_keys/current");
  t.is(res.status, 200);
  t.like(res.data, {
    id: process.env.API_KEY_ID_TEST_GOOD,
    kind: "test",
  });
  t.assert(res.data.id.length > 0);
  t.is(res.data.key, undefined);
});
(0, ava_1.default)("modify current api key", async (t) => {
  const res = await (0, setup_1.rolo)().patch("api_keys/current", {
    "description": "foo",
  });
  t.is(res.status, 405);
});
(0, ava_1.default)("delete current api key", async (t) => {
  const res = await (0, setup_1.rolo)().delete("api_keys/current");
  t.is(res.status, 405);
});
(0, ava_1.default)("options current api key", async (t) => {
  const res = await (0, setup_1.rolo)().options("api_keys/current");
  t.is(res.status, 200);
  const allow = res.headers["allow"].split(", ").sort();
  t.deepEqual(allow, ["GET", "HEAD"]);
});
(0, ava_1.default)("options current api key by id", async (t) => {
  const res = await (0, setup_1.rolo)().options(
    "api_keys/" + process.env.API_KEY_ID_TEST_GOOD,
  );
  t.is(res.status, 200);
  const allow = res.headers["allow"].split(", ").sort();
  t.deepEqual(allow, ["DELETE", "GET", "HEAD", "PATCH"]);
});
(0, ava_1.default)("delete current api key by id", async (t) => {
  const res = await (0, setup_1.rolo)().delete(
    "api_keys/" + process.env.API_KEY_ID_TEST_GOOD,
  );
  t.is(res.status, 400);
});
(0, ava_1.default)("modify current api key by id", async (t) => {
  const res = await (0, setup_1.rolo)().patch(
    "api_keys/" + process.env.API_KEY_ID_TEST_GOOD,
    { "description": "foo" },
  );
  t.is(res.status, 400);
});
(0, ava_1.default)("modify other api key by id", async (t) => {
  const str = "random " + (0, chewit_1.randomString)({ length: 10 });
  const res = await (0, setup_1.rolo)().patch(
    "api_keys/" + process.env.API_KEY_ID_TEST_NO_SCOPES,
    { "description": str },
  );
  t.is(res.status, 200);
});
