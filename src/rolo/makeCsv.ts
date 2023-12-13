function makeCsvString(val: unknown) {
  if (typeof val === "string") return val;
  if (typeof val === "number") return val.toString();
  if (typeof val === "boolean") return val.toString();
  if (val instanceof Date) return val.toISOString();
  if (val === null) return "";
  if (val === undefined) return "";
  // todo: handle nested objects using key path
  return "OBJECT";
}

function makeCsvRow(row: Record<string, string>, header: string[]) {
  return header.map((k) => `"${makeCsvString(row[k])}"`).join(",");
}

function determineKeys(rows: Record<string, string>[]) {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}

export function makeCsv(rows: Record<string, string>[]) {
  if (rows.length === 0) return "";
  const header = determineKeys(rows).filter((k) => k !== "object");
  const body = rows.map((row) => makeCsvRow(row, header));
  return [header.map((k) => (k === "_id" ? "id" : k)), ...body].join("\n");
}
