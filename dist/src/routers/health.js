"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const auth_1 = require("../auth");
const Router = require("@koa/router");
const chewit_1 = require("@pilotmoon/chewit");
const database_1 = require("../database");
function getCollection(kind) {
  const db = (0, database_1.getDb)(kind);
  return db.collection("health");
}
exports.router = new Router();
// health check endpoint
exports.router.get("/health", async (ctx, next) => {
  console.log("health");
  await (0, auth_1.verifyScope)("health:read", ctx.state.auth);
  // add object identifier to response
  const health = { "object": "health" };
  // add random string to test caching
  health.random = (0, chewit_1.randomString)({ length: 10 });
  // test database connection
  const coll = getCollection(ctx.state.auth.kind);
  health.database = await coll.insertOne(health);
  // return response
  ctx.body = health;
  await next();
});
