import { Context, Next } from "koa";
import { ApiError } from "../../errors";

// error if content-type is not application/json
export async function enforceJson(ctx: Context, next: Next) {
  const length = ctx.request.length;
  const hasContent = typeof length === "number" && length > 0;
  const isJson = ctx.request.is("application/json") === "application/json";
  if (hasContent && !isJson) {
    throw new ApiError(415, "Content-Type must be application/json");
  }
  await next();
}
