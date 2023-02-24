import { Context, Next } from "koa";
import { log } from "../logger";

export async function measureResponseTime(ctx: Context, next: Next) {
  const start = Date.now();
  await next();
  const time = `${Date.now() - start} ms`;
  log("Response time:", time);
  ctx.set("X-Response-Time", time);
}
