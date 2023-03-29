import { Context, Next } from "koa";
import { ApiError } from "../../errors.js";
import { distantFuture, distantPast, Pagination } from "../paginate.js";

export function processPagination() {
  return async function (ctx: Context, next: Next) {
    function getQueryString(name: string) {
      const value = ctx.query[name];
      if (typeof value === "undefined" || typeof value === "string") {
        return value;
      }
      if (Array.isArray(value)) {
        throw new ApiError(400, `duplicated ${name} parameter in query`);
      }
      throw new ApiError(400, `problem with ${name} parameter in query`);
    }
    function getQueryInteger(
      name: string,
      defaultValue: number,
      minimumValue: number = 0,
      maximumValue: number = Number.MAX_SAFE_INTEGER,
    ) {
      const result = Number(getQueryString(name) ?? defaultValue);
      if (isNaN(result) || !Number.isInteger(result)) {
        throw new ApiError(400, `${name} must be an integer`);
      }
      if (result < minimumValue || result > maximumValue) {
        throw new ApiError(
          400,
          `${name} must be >= ${minimumValue} and <= ${maximumValue}`,
        );
      }
      return result;
    }

    const order = getQueryInteger("order", -1, -1, 1);
    if (order !== 1 && order !== -1) {
      throw new ApiError(400, "order must be 1 or -1");
    }

    const pagination: Pagination = {
      offset: getQueryInteger("offset", 0),
      limit: getQueryInteger("limit", 10, 1, 100),
      order,
      orderBy: "created",
      startCursor: getQueryString("cursor"),
      gteDate: new Date(getQueryString("gteDate") ?? distantPast),
      ltDate: new Date(getQueryString("ltDate") ?? distantFuture),
    };
    ctx.state.pagination = pagination;
    await next();
  };
}
