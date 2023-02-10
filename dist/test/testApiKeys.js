"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const setup_1 = require("./setup");
(0, ava_1.default)("missing payload", async (t) => {
  const res = await (0, setup_1.rolo)().post("apikeys");
  t.is(res.status, 400);
  t.is(res.data, "");
});
