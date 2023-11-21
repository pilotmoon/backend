import { config } from "../config.js";
import { ApiError } from "../../errors.js";
import { log } from "../../logger.js";
import _ from "lodash";
import { Context, Next } from "koa";

export async function checkAccess(ctx: Context, next: Next) {
  const ips = _.union(ctx.request.ips, [ctx.request.ip]);
  const allow = config.ACCESS_ALLOWLIST;
  log("IPs:", ips, "Allow:", allow);
  if (allow.length > 0 && _.intersection(ips, allow).length === 0) {
    throw new ApiError(403, "Access denied");
  }
  await next();
}
