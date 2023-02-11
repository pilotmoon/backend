"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const setup_1 = require("./setup");
ava_1.default.serial("health", async (t) => {
  const res = await (0, setup_1.rolo)().get("health");
  t.is(res.status, 200);
  t.like(res.data, { object: "health", livemode: false });
});
(0, ava_1.default)("health, query string", async (t) => {
  const res = await (0, setup_1.rolo)().get("health?foo=bar");
  t.is(res.status, 200);
  t.like(res.data, { object: "health", livemode: false });
});
(0, ava_1.default)("health, trailing slash", async (t) => {
  const res = await (0, setup_1.rolo)().get("health/");
  t.is(res.status, 200);
  t.like(res.data, { object: "health", livemode: false });
});
(0, ava_1.default)("health, query string, trailing slash", async (t) => {
  const res = await (0, setup_1.rolo)().get("health/?foo=bar");
  t.is(res.status, 200);
  t.like(res.data, { object: "health", livemode: false });
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
