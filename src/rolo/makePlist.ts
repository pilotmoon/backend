const header = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
`;
const footer = `
</plist>`;
export function makePlist(obj: unknown) {
  if (Array.isArray(obj)) {
    return header + makePlistArray(obj) + footer;
  }
  if (typeof obj === "object" && obj !== null) {
    return header + makePlistObject(obj) + footer;
  }
  return makePlistScalar(obj);
}
function makePlistScalar(item: unknown) {
  if (item instanceof Date) {
    return `<date>${item.toISOString().slice(0, -5)}Z</date>`;
  }
  if (typeof item === "string") {
    return item === "" ? "<string/>" : `<string>${item}</string>`;
  }
  if (typeof item === "number") {
    if (item % 1 === 0) {
      return `<integer>${item}</integer>`;
    }
    return `<real>${item}</real>`;
  }
  if (typeof item === "boolean") {
    return item ? "<true/>" : "<false/>";
  }
  throw new Error(
    `Can't make plist scalar for type ${typeof item}, value ${item}`,
  );
}
function space(indent: number) {
  return " ".repeat(indent * 2);
}
function makePlistArray(items: unknown[], indent = 1) {
  if (items.length === 0) {
    return "<array/>";
  }
  const result: string[] = [];
  for (const item of items) {
    if (typeof item === "object" && item !== null) {
      result.push(space(indent) + makePlistObject(item, indent + 1));
    } else if (Array.isArray(item)) {
      result.push(space(indent) + makePlistArray(item, indent + 1));
    } else {
      result.push(space(indent) + makePlistScalar(item));
    }
  }
  return `<array>\n${result.join("\n")}\n${space(indent - 1)}</array>`;
}
function makePlistObject(item: object, indent = 1) {
  if (item instanceof Date) {
    return makePlistScalar(item);
  }
  if (Object.keys(item).length === 0) {
    return "<dict/>";
  }
  const result: string[] = [];
  for (const [k, v] of Object.entries(item)) {
    if (Array.isArray(v)) {
      result.push(
        space(indent) +
          `<key>${k}</key>\n${space(indent) + makePlistArray(v, indent + 1)}`,
      );
    } else if (typeof v === "object" && v !== null) {
      result.push(
        space(indent) +
          `<key>${k}</key>\n${space(indent) + makePlistObject(v, indent + 1)}`,
      );
    } else {
      result.push(
        space(indent) +
          `<key>${k}</key>\n${space(indent) + makePlistScalar(v)}`,
      );
    }
  }
  return `<dict>\n${result.join("\n")}\n${space(indent - 1)}</dict>`;
}
