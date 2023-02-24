import { Context, Next } from "koa";
import { ApiError } from "../errors";

// error if content-type is not application/json
export async function enforceJson(ctx: Context, next: Next) {
  const match = ctx.request.is("application/json");
  const hasContent = typeof ctx.request.length === "number" &&
    ctx.request.length > 0;
  if (hasContent && match !== "application/json") {
    throw new ApiError(415, "Content-Type must be application/json");
  }
  await next();
}
