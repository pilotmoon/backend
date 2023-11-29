import { constants } from "node:buffer";
import { ApiError } from "../../common/errors.js";
import { log, logw } from "../../common/log.js";
import { generateReport } from "../controllers/reportsController.js";
import { makeRouter } from "../koaWrapper.js";

export const router = makeRouter({ prefix: "/reports" });

function daysAgo(days: number) {
  const result = new Date();
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// health check endpoint
router.get("/:name", async (ctx) => {
  // default start date to 30 days ago 00:00:00
  const gteDate = ctx.state.pagination.gteDate
    ? ctx.state.pagination.gteDate
    : daysAgo(7);
  // default end date to start date + 1 day
  const ltDate = ctx.state.pagination.ltDate
    ? ctx.state.pagination.ltDate
    : addDays(gteDate, 7);
  // error if date range is invalid
  if (ltDate <= gteDate) throw new ApiError(400, "Invalid date range");

  // convery query to record<string, string>
  const query = Object.fromEntries(
    Object.entries(ctx.query).map(([k, v]) => [k, String(v)]),
  );

  const report = await generateReport(
    ctx.state.auth,
    gteDate,
    ltDate,
    ctx.params.name,
    query,
  );

  if (Array.isArray(report) && query.format === "csv") {
    ctx.set("Content-Type", "text/csv");
    ctx.body = makeCsv(report);
  } else if (query.format === "objc") {
    ctx.set("Content-Type", "text/plain");
    ctx.body = makeObjc(report);
  } else {
    ctx.body = {
      object: "report",
      dateRange: [gteDate, ltDate],
      query: query,
      reportType: ctx.params.name,
      report,
    };
  }
});

function makeCsvRow(row: Record<string, string>) {
  return Object.values(row)
    .map((v) => `"${v}"`)
    .join(",");
}

function makeCsv(rows: Record<string, string>[]) {
  if (rows.length === 0) return "";
  const header = Object.keys(rows[0]);
  const body = rows.map(makeCsvRow);
  return [header, ...body].join("\n");
}

function space(indent: number) {
  return " ".repeat(indent * 2);
}

function makeObjc(obj: unknown) {
  if (Array.isArray(obj)) {
    return makeObjcArray(obj);
  } else if (typeof obj === "object" && obj !== null) {
    return makeObjcObject(obj);
  } else {
    return makeObjcScalar(obj);
  }
}

function makeObjcScalar(item: unknown) {
  if (item === null) {
    return "[NSNull null]";
  } else if (typeof item === "string") {
    return `@"${item}"`;
  } else if (typeof item === "number") {
    return `@(${item})`;
  } else if (typeof item === "boolean") {
    return item ? "@YES" : "@NO";
  } else {
    throw new Error(`Can't format objective-c type for: ${typeof item}`);
  }
}

// fomat as an objective-c object (NSArray and NSDictionary lioterals)
function makeObjcArray(items: unknown[], indent = 1) {
  const result: string[] = [];
  for (const item of items) {
    if (typeof item === "object" && item !== null) {
      result.push(space(indent) + makeObjcObject(item, indent + 1));
    } else if (Array.isArray(item)) {
      result.push(space(indent) + makeObjcArray(item, indent + 1));
    } else {
      result.push(space(indent) + makeObjcScalar(item));
    }
  }
  return `@[\n${result.join(",\n")}\n${space(indent - 1)}]`;
}

function makeObjcObject(item: object, indent = 2) {
  const result: string[] = [];
  for (const [k, v] of Object.entries(item)) {
    if (Array.isArray(v)) {
      result.push(space(indent) + `@"${k}": ${makeObjcArray(v, indent + 1)}`);
    } else if (typeof v === "object" && v !== null) {
      result.push(space(indent) + `@"${k}": ${makeObjcObject(v, indent + 1)}`);
    } else {
      result.push(space(indent) + `@"${k}": ${makeObjcScalar(v)}`);
    }
  }
  return `@{\n${result.join(",\n")}\n${space(indent - 1)}}`;
}
