"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const setup_1 = require("./setup");
(0, ava_1.default)("missing api key", async (t) => {
  const res = await (0, setup_1.rolo)().get("healthcheck", {
    headers: { "Authorization": null },
  });
  t.is(res.status, 401);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});
(0, ava_1.default)("bad auth key format", async (t) => {
  const res = await (0, setup_1.rolo)().get("healthcheck", {
    headers: { "Authorization": "blah blah" },
  });
  t.is(res.status, 401);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});
(0, ava_1.default)("unknown api key", async (t) => {
  const res = await (0, setup_1.rolo)().get("healthcheck", {
    headers: { "Authorization": "Bearer blah blah" },
  });
  t.is(res.status, 401);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});
(0, ava_1.default)("unknown api key, x-api-key", async (t) => {
  const res = await (0, setup_1.rolo)().get("healthcheck", {
    headers: { "Authorization": null, "X-Api-Key": "blah blah" },
  });
  t.is(res.status, 401);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});
(0, ava_1.default)("create api key, missing payload", async (t) => {
  const res = await (0, setup_1.rolo)().post("api_keys");
  t.is(res.status, 400);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});
(0, ava_1.default)("create api key, unknown scope", async (t) => {
  const res = await (0, setup_1.rolo)().post("api_keys", {
    scopes: ["foo"],
  });
  t.is(res.status, 400);
  t.assert(res.data.error.message.length > 0);
  t.log(res.data.error.message);
});
(0, ava_1.default)("api key CRUD", async (t) => {
  // create new key
  const res = await (0, setup_1.rolo)().post("api_keys", {
    scopes: [],
    description: "crud test key",
    blah: "blah",
  });
  t.is(res.status, 201);
  const location = res.headers["location"];
  t.assert(
    location.length > 0 &&
      location.startsWith(process.env.APP_URL),
  );
  t.log(location);
  // get the key
  const res2 = await (0, setup_1.rolo)().get(location);
  t.is(res2.status, 200);
  t.like(res2.data, {
    kind: "test",
    scopes: [],
  });
  t.assert(res2.data.id.length > 0);
  t.assert(res2.data.key.length > 0);
  t.is(res2.data.description, "crud test key");
  t.is(res2.data.blah, undefined);
  // update the key
  const res3 = await (0, setup_1.rolo)().put(location, {
    scopes: ["api_keys:read"],
  });
  // delete the key
});
