import { verifyScope } from "../auth";
import { makeRouter } from "../koa";
import { randomString } from "@pilotmoon/chewit";
import { DatabaseKind, getDb } from "../database";
import { config } from "../config";

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
  // insert uptime
  health.uptime = Math.floor(process.uptime());
  // insert commit hash
  health.commit = config.COMMIT_HASH;
  // insert request info
  health.url = String(ctx.request.url);
  health.method = String(ctx.request.method);
  health.headers = ctx.request.headers;
  // test database connection
  const coll = getCollection(ctx.state.auth.kind);
  const dbInsert = await coll.insertOne(health);
  const dbDelete = await coll.deleteOne({ _id: dbInsert.insertedId });
  health.selfTest = { dbInsert, dbDelete };
  // return response
  ctx.body = health;
  await next();
});
