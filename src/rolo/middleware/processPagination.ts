import { Context, Next } from "koa";
import { ApiError } from "../../common/errors.js";
import { ZPagination } from "../paginate.js";

export function processPagination() {
  return async (ctx: Context, next: Next) => {
    function getQueryString(name: string, defaultValue?: string) {
      const value = ctx.query[name];
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "undefined") {
        return defaultValue;
      }
      if (Array.isArray(value)) {
        throw new ApiError(400, `duplicated ${name} parameter in query`);
      }
      throw new ApiError(400, `problem with ${name} parameter in query`);
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
      sort: getQueryInteger("sort", -1),
      sortBy: getQueryString("sortBy", "created"),
      cursor: getQueryString("cursor"),
      gteDate: getQueryString("gteDate"),
      ltDate: getQueryString("ltDate"),
    });
    await next();
  };
}
