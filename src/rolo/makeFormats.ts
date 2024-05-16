import { makeCsv } from "./makeCsv.js";
import { makeObjc } from "./makeObjc.js";
import { makePlist } from "./makePlist.js";
import { stringFromQuery } from "../common/query.js";
import makeStableJson from "fast-stable-stringify";
import { AppContext } from "./koaWrapper.js";

function preprocess(ctx: AppContext, obj: unknown) {
  if (typeof obj !== "object" || obj === null) {
    throw new Error("Response must be an object");
  }
  if (Array.isArray(obj)) {
    const extract = stringFromQuery(ctx.query, "extract", "");
    if (extract) {
      const keyPath = extract.split(".");
      return obj.map((item) => {
        let value = item;
        for (const key of keyPath) {
          value = value[key];
        }
        return value;
      });
    }
    return obj.map((item) => {
      const { _id, object, ...rest } = item;
      return { id: _id, ...rest };
    });
  }
  return obj;
}

export function setBodySpecialFormat(ctx: AppContext, obj: unknown) {
  switch (ctx.query.format) {
    case "json":
      ctx.set("Content-Type", "application/json; charset=utf-8");
      ctx.body = makeStableJson(preprocess(ctx, obj));
      break;
    case "csv":
      ctx.set("Content-Type", "text/csv; charset=utf-8");
      ctx.body = makeCsv(preprocess(ctx, obj));
      break;
    case "objc":
      ctx.set("Content-Type", "text/plain; charset=utf-8");
      ctx.body = makeObjc(preprocess(ctx, obj));
      break;
    case "plist":
      ctx.set("Content-Type", "application/x-plist; charset=utf-8");
      ctx.body = makePlist(preprocess(ctx, obj));
      break;
    default:
      return false;
  }
  return true;
}
