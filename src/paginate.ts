import { Context, Next } from "koa";
import { max } from "lodash";
import { log } from "./logger";

export type PaginateOptions = {
  maximumLimit?: number;
  defaultLimit?: number;
};

export type PaginateState = {
  offset: number;
  limit: number;
};

export function paginator(
  { maximumLimit = 100, defaultLimit = 10 }: PaginateOptions = {},
) {
  return async function (ctx: Context, next: Next) {
    function getQueryNumber(name: string, defaultValue: number) {
      let result = defaultValue;
      const query = ctx.query[name];
      if (typeof query === "string") {
        const value = parseInt(query, 10);
        if (!isNaN(value)) result = value;
      }
      return result;
    }

    const offset = Math.abs(getQueryNumber("offset", 0));
    const limit = Math.min(
      Math.abs(getQueryNumber("limit", defaultLimit)),
      maximumLimit,
    );

    ctx.state.paginate = { offset, limit };
    await next();
  };
}
