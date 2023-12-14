export function makeObjc(obj: unknown) {
  if (Array.isArray(obj)) {
    return makeObjcArray(obj);
  }
  if (typeof obj === "object" && obj !== null) {
    return makeObjcObject(obj);
  }
  return makeObjcScalar(obj);
}
function makeObjcScalar(item: unknown) {
  if (item === null) {
    return "[NSNull null]";
  }
  if (typeof item === "string") {
    return `@"${item}"`;
  }
  if (typeof item === "number" && isFinite(item)) {
    return `@${item}`;
  }
  if (typeof item === "boolean") {
    return item ? "@YES" : "@NO";
  }
  throw new Error(
    `Can't make objc scalar for type ${typeof item}, value ${item}`,
  );
}
function space(indent: number) {
  return " ".repeat(indent * 2);
}
function makeObjcArray(items: unknown[], indent = 1) {
  if (items.length === 0) {
    return "@[]";
  }
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
  return `@[\n${result.join(",\n")},\n${space(indent - 1)}]`;
}
function makeObjcObject(item: object, indent = 1) {
  if (item instanceof Date) {
    return makeObjcScalar(item.toISOString());
  }
  if (Object.keys(item).length === 0) {
    return "@{}";
  }
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
  return `@{\n${result.join(",\n")},\n${space(indent - 1)}}`;
}
