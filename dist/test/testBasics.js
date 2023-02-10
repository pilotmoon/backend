"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const setup_1 = require("./setup");
(0, ava_1.default)("healthcheck", async (t) => {
  const res = await (0, setup_1.rolo)().get("healthcheck");
  t.is(res.status, 200);
  t.like(res.data, { healthcheck: true, livemode: false });
});
(0, ava_1.default)("healthcheck, query string", async (t) => {
  const res = await (0, setup_1.rolo)().get("healthcheck?foo=bar");
  t.is(res.status, 200);
  t.like(res.data, { healthcheck: true, livemode: false });
});
(0, ava_1.default)("healthcheck, trailing slash", async (t) => {
  const res = await (0, setup_1.rolo)().get("healthcheck/");
  t.is(res.status, 200);
  t.like(res.data, { healthcheck: true, livemode: false });
});
(0, ava_1.default)("healthcheck, query string, trailing slash", async (t) => {
  const res = await (0, setup_1.rolo)().get("healthcheck/?foo=bar");
  t.is(res.status, 200);
  t.like(res.data, { healthcheck: true, livemode: false });
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
