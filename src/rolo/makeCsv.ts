function makeCsvRow(row: Record<string, string>) {
  return Object.values(row)
    .map((v) => `"${v}"`)
    .join(",");
}
export function makeCsv(rows: Record<string, string>[]) {
  if (rows.length === 0) return "";
  const header = Object.keys(rows[0]);
  const body = rows.map(makeCsvRow);
  return [header, ...body].join("\n");
}
