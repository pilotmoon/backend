function makeCsvString(val: unknown) {
  if (typeof val === "string") return val;
  if (typeof val === "number") return val.toString();
  if (typeof val === "boolean") return val.toString();
  if (val instanceof Date) return val.toISOString();
  if (val === null) return "";
  if (val === undefined) return "";
  if (Array.isArray(val)) return "ARRAY";
  if (typeof val === "object") return "OBJECT";
  return "UNKNOWN";
}

function makeCsvRow(row: Record<string, unknown>, header: string[]) {
  return header.map((k) => `"${makeCsvString(row[k])}"`).join(",");
}

function determineKeys(rows: Record<string, unknown>[]) {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}

export function makeCsv(obj: unknown) {
  let rows: Record<string, unknown>[] = [];
  if (!Array.isArray(obj)) {
    rows = [obj as Record<string, unknown>];
  } else {
    rows = obj as Record<string, unknown>[];
  }
  if (rows.length === 0) {
    return "";
  }
  const header = determineKeys(rows);
  const body = rows.map((row) => makeCsvRow(row, header));
  return [header, ...body].join("\n");
}
