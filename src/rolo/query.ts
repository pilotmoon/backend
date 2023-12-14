import { z } from "zod";

export const ZBoolQueryValue = z.enum(["", "1", "0"]);

// convert query value to boolean with fallback
// this is an important design decision for the API.
// we define "presence of parameter" and "1" as explicitly true,
// and "0" as explicitly false. for any other value, the
// fallback value is used.
export function boolFromQueryValue(val: unknown, fallback: boolean) {
  if (val === "" || val === "1") {
    return true;
  }
  if (val === "0") {
    return false;
  }
  return fallback;
}

// mongodb query for boolean flag field
export function matchExpressionFromQueryValue(val: string) {
  if (val === "" || val === "1") {
    return true; // match true only
  }
  if (val === "0") {
    return { $ne: true }; // match anything but true
  }
  return undefined; // don't match on this field
}

// insert query value into document that will be used in a $match stage,
// optionally transforming the value first.
export function assignMatch(
  doc: Record<string, unknown>,
  docKey: string,
  val: unknown,
  transform?: (
    val: string,
  ) => Record<string, unknown> | string | boolean | undefined,
) {
  if (typeof val === "string") {
    const transformed = transform ? transform(val) : val;
    if (transformed !== undefined) {
      doc[docKey] = transformed;
    }
  }
}
