"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const setup_1 = require("./setup");
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
(0, ava_1.default)("unknown api key, x-api-key", async (t) => {
  const res = await (0, setup_1.rolo)().get("health", {
    headers: { "Authorization": null, "X-Api-Key": "blah blah" },
  });
  t.is(res.status, 401);
});
(0, ava_1.default)("create api key, missing payload", async (t) => {
  const res = await (0, setup_1.rolo)().post("api_keys");
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
