"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const auth_1 = require("../auth");
const koa_1 = require("../koa");
const chewit_1 = require("@pilotmoon/chewit");
const database_1 = require("../database");
const config_1 = require("../config");
function getCollection(kind) {
  const db = (0, database_1.getDb)(kind);
  return db.collection("health");
}
exports.router = (0, koa_1.makeRouter)();
// health check endpoint
exports.router.get("/health", async (ctx) => {
  await (0, auth_1.verifyScope)("health:read", ctx.state.auth);
  // add object identifier to response
  const health = { "object": "health" };
  // add random string to test caching
  health.random = (0, chewit_1.randomString)({ length: 10 });
  // insert date and uptime
  health.now = new Date();
  health.uptime = Math.floor(process.uptime());
  // insert commit hash
  health.commit = config_1.config.COMMIT_HASH;
  // insert request info
  health.url = String(ctx.request.url);
  health.method = String(ctx.request.method);
  health.headers = ctx.request.headers;
  // test database connection
  const coll = getCollection(ctx.state.auth.kind);
  const document = await coll.insertOne(health);
  const deleteResult = await coll.deleteOne({ _id: document.insertedId });
  health.selfTest = {
    database: deleteResult.acknowledged && deleteResult.deletedCount === 1,
  };
  ctx.body = health;
});
