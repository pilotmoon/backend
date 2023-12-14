import { Context } from "koa";
import { makeCsv } from "./makeCsv.js";
import { makeObjc } from "./makeObjc.js";
import { makePlist } from "./makePlist.js";
import { stringFromQuery } from "./query.js";

function preprocess(ctx: Context, obj: unknown) {
  if (typeof obj !== "object" || obj === null) {
    throw new Error("Response must be an object");
  }
  if (Array.isArray(obj)) {
    const extract = stringFromQuery(ctx.query, "extract", "");
    if (extract) {
      return obj.map((item) => item[extract]);
    }
  }
  return obj;
}

export function setBodySpecialFormat(ctx: Context, obj: unknown) {
  if (ctx.query.format === "jsontext") {
    ctx.set("Content-Type", "application/json");
    ctx.body = JSON.stringify(preprocess(ctx, obj), null, 2);
  } else if (ctx.query.format === "csv") {
    ctx.set("Content-Type", "text/csv");
    ctx.body = makeCsv(preprocess(ctx, obj));
  } else if (ctx.query.format === "objc") {
    ctx.set("Content-Type", "text/plain");
    ctx.body = makeObjc(preprocess(ctx, obj));
  } else if (ctx.query.format === "plist") {
    ctx.set("Content-Type", "application/x-plist");
    ctx.body = makePlist(preprocess(ctx, obj));
  } else {
    return false;
  }
  return true;
}
