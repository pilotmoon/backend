"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const setup_1 = require("./setup");
(0, ava_1.default)("missing api key", async (t) => {
  const res = await (0, setup_1.rolo)().get("healthcheck", {
    headers: { "X-Api-Key": "" },
  });
  t.is(res.status, 401);
  t.assert(res.data.error.message.length > 0);
});
(0, ava_1.default)("healthcheck", async (t) => {
  const res = await (0, setup_1.rolo)().get("healthcheck");
  t.is(res.status, 200);
  t.deepEqual(res.data, { healthcheck: true });
});
(0, ava_1.default)("healthcheck, query string", async (t) => {
  const res = await (0, setup_1.rolo)().get("healthcheck?foo=bar");
  t.is(res.status, 200);
  t.deepEqual(res.data, { healthcheck: true });
});
(0, ava_1.default)("healthcheck, trailing slash", async (t) => {
  const res = await (0, setup_1.rolo)().get("healthcheck/");
  t.is(res.status, 200);
  t.deepEqual(res.data, { healthcheck: true });
});
(0, ava_1.default)("healthcheck, query string, trailing slash", async (t) => {
  const res = await (0, setup_1.rolo)().get("healthcheck/?foo=bar");
  t.is(res.status, 200);
  t.deepEqual(res.data, { healthcheck: true });
});
(0, ava_1.default)("healthcheck, post (method not allowed)", async (t) => {
  const res = await (0, setup_1.rolo)().post("healthcheck");
  t.is(res.status, 405);
});
(0, ava_1.default)("not found", async (t) => {
  const res = await (0, setup_1.rolo)().get("not-found");
  t.is(res.status, 404);
});
(0, ava_1.default)("not found, root", async (t) => {
  const res = await (0, setup_1.rolo)().get("");
  t.is(res.status, 404);
});
(0, ava_1.default)("not found, root, trailing slash", async (t) => {
  const res = await (0, setup_1.rolo)().get("/");
  t.is(res.status, 404);
});
