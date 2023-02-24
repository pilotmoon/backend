import { assertScope } from "../controllers/authController";
import { makeRouter } from "../koaWrapper";
import { randomString } from "@pilotmoon/chewit";
import { getDb } from "../database";
import { config } from "../config";
import { KeyKind } from "../identifiers";

function getCollection(kind: KeyKind) {
  const db = getDb(kind);
  return db.collection("health");
}

export const router = makeRouter();

// health check endpoint
router.get("/health", async (ctx) => {
  assertScope("health:read", ctx.state.auth);

  // add object identifier to response
  const health = { "object": "health" } as any;

  // add random string to response
  health.name = "Pilotmoon API Server v2";
  health.random = randomString({ length: 10 });

  // insert date and uptime
  health.now = new Date();
  health.uptime = Math.floor(process.uptime());

  // insert commit hash
  health.commit = config.COMMIT_HASH;

  // insert request info
  // health.url = String(ctx.request.url);
  // health.method = String(ctx.request.method);
  // health.headers = ctx.request.headers;

  // test database connection
  // const coll = getCollection(ctx.state.auth.kind);
  // const document = await coll.insertOne(health);
  // const deleteResult = await coll.deleteOne({ _id: document.insertedId });
  // health.selfTest = {
  //   database: deleteResult.acknowledged && deleteResult.deletedCount === 1,
  // };

  ctx.body = health;
});
