import { Context, Next } from "koa";
import { max } from "lodash";
import { ApiError } from "./errors";
import { log } from "./logger";

export type PaginateOptions = {
  maximumLimit?: number;
  defaultLimit?: number;
};

export type PaginateState = {
  offset: number;
  limit: number;
  order: 1 | -1;
};

export function paginator(
  { maximumLimit = 100, defaultLimit = 10 }: PaginateOptions = {},
) {
  return async function (ctx: Context, next: Next) {
    function getQueryNumber(name: string, defaultValue: number) {
      const query = ctx.query[name];
      if (typeof query === "undefined") {
        return defaultValue;
      }
      if (typeof query === "string") {
        const result = parseInt(query, 10);
        if (isNaN(result)) {
          throw new ApiError(400, `${name} must be a number`);
        }
        return result;
      }
      throw new ApiError(
        400,
        `invalid or duplicated ${name} parameter in query`,
      );
    }

    const offset = getQueryNumber("offset", 0);
    const limit = Math.min(
      getQueryNumber("limit", defaultLimit),
      maximumLimit,
    );
    const order = getQueryNumber("order", -1);

    if (offset < 0) {
      throw new ApiError(400, "offset must be >= 0");
    }
    if (limit <= 0) {
      throw new ApiError(400, "limit must be > 0");
    }
    if (order !== 1 && order !== -1) {
      throw new ApiError(400, "order must be 1 or -1");
    }

    ctx.state.paginate = { offset, limit, order };
    await next();
  };
}
