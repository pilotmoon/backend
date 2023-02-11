import { verifyScope } from "../auth";
import { makeRouter } from "../koa";
import { randomString } from "@pilotmoon/chewit";
import { DatabaseKind, getDb } from "../database";

function getCollection(kind: DatabaseKind) {
  const db = getDb(kind);
  return db.collection("health");
}

export const router = makeRouter();

// health check endpoint
router.get("/health", async (ctx, next) => {
  console.log("health");
  await verifyScope("health:read", ctx.state.auth);
  // add object identifier to response
  const health = { "object": "health" } as any;
  // add random string to test caching
  health.random = randomString({ length: 10 });
  // insert date
  health.now = new Date();
  // insert request details
  health.url = ctx.URL;
  // test database connection
  const coll = getCollection(ctx.state.auth.kind);
  health.database = await coll.insertOne(health);
  // return response
  ctx.body = health;
  await next();
});
