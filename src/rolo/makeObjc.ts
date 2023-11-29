export function makeObjc(obj: unknown) {
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
function space(indent: number) {
  return " ".repeat(indent * 2);
}
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
function makeObjcObject(item: object, indent = 1) {
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
