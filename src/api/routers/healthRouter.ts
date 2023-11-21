import { makeRouter } from "../koaWrapper.js";
import { randomString } from "@pilotmoon/chewit";
import { config } from "../config.js";

export const router = makeRouter();

// health check endpoint
router.get("/health", async (ctx) => {
  ctx.state.auth.assertAccess("health", undefined, "read");

  // add object identifier to response
  const health = { object: "health" } as any;

  // add random string to response
  health.name = "Pilotmoon API Server v2";
  health.random = randomString({ length: 10 });

  // insert date and uptime
  health.now = new Date();
  health.uptime = Math.floor(process.uptime());

  // insert commit hash
  health.commit = config.COMMIT_HASH;

  ctx.body = health;
});
