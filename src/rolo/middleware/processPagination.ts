import { Context, Next } from "koa";
import { ApiError } from "../../errors.js";
import { ZPagination } from "../paginate.js";

export function processPagination() {
  return async function (ctx: Context, next: Next) {
    function getQueryString(name: string) {
      const value = ctx.query[name];
      if (typeof value === "undefined" || typeof value === "string") {
        return value;
      } else if (Array.isArray(value)) {
        throw new ApiError(400, `duplicated ${name} parameter in query`);
      } else {
        throw new ApiError(400, `problem with ${name} parameter in query`);
      }
    }
    function getQueryInteger(name: string, defaultValue: number) {
      const result = Number(getQueryString(name) ?? defaultValue);
      if (Number.isNaN(result) || !Number.isInteger(result)) {
        throw new ApiError(400, `${name} must be an integer`);
      }
      return result;
    }

    ctx.state.pagination = ZPagination.parse({
      offset: getQueryInteger("offset", 0),
      limit: getQueryInteger("limit", 10),
      order: getQueryInteger("order", -1),
      orderBy: "created",
      cursor: getQueryString("cursor"),
      gteDate: getQueryString("gteDate"),
      ltDate: getQueryString("ltDate"),
    });
    await next();
  };
}
