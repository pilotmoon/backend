import { config } from "../config";
import { ApiError } from "../errors";
import { log } from "../logger";
import { intersection, union } from "lodash";
import { Context, Next } from "koa";

export async function checkAccess(ctx: Context, next: Next) {
  const ips = union(ctx.request.ips, [ctx.request.ip]);
  const allow = config.ACCESS_ALLOWLIST;
  log("IPs:", ips, "Allow:", allow);
  if (allow.length > 0 && intersection(ips, allow).length == 0) {
    throw new ApiError(403, "Access denied");
  }
  await next();
}
