import { verifyScope } from "../auth";
import Router = require("@koa/router");
import { randomString } from "@pilotmoon/chewit";
import { DatabaseKind, getDb } from "../database";

function getCollection(kind: DatabaseKind) {
  const db = getDb(kind);
  return db.collection("health");
}

export const router = new Router();

// health check endpoint
router.get("/health", async (ctx, next) => {
  console.log("health");
  await verifyScope("health:read", ctx.state.auth);
  // add object identifier to response
  const health = { "object": "health" } as any;
  // add random string to test caching
  health.random = randomString({ length: 10 });
  // test database connection
  const coll = getCollection(ctx.state.auth.kind);
  const document = await coll.insertOne(health);
  health.database = String(document.insertedId);
  ctx.body = health;
  await next();
});
