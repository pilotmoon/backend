import { Context, Next } from "koa";
import { ApiError } from "../errors";

export type PaginateOptions = {
  maximumLimit?: number;
  defaultLimit?: number;
};

export type PaginateState = {
  offset: number;
  limit: number;
  order: 1 | -1;
  orderBy: "created";
};

export function processPagination(
  { maximumLimit = 100, defaultLimit = 10 }: PaginateOptions = {},
) {
  return async function (ctx: Context, next: Next) {
    function getQueryInteger(name: string, defaultValue: number) {
      const query = ctx.query[name];
      if (typeof query === "undefined") {
        return defaultValue;
      }
      if (typeof query === "string") {
        const result = Number(query);
        if (isNaN(result) || !Number.isInteger(result)) {
          throw new ApiError(400, `${name} must be an integer`);
        }
        return result;
      }
      if (Array.isArray(query)) {
        throw new ApiError(400, `duplicated ${name} parameter in query`);
      }
      throw new ApiError(400, `problem with ${name} parameter in query`);
    }

    const offset = getQueryInteger("offset", 0);
    const limit = Math.min(
      getQueryInteger("limit", defaultLimit),
      maximumLimit,
    );
    const order = getQueryInteger("order", -1);

    if (offset < 0) {
      throw new ApiError(400, "offset must be >= 0");
    }
    if (limit <= 0) {
      throw new ApiError(400, "limit must be > 0");
    }
    if (order !== 1 && order !== -1) {
      throw new ApiError(400, "order must be 1 or -1");
    }

    ctx.state.paginate = { offset, limit, order, orderBy: "created" };
    await next();
  };
}
