// return a new object without the specified key
export function omit(
  obj: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const { [key]: removed, ...rest } = obj;
  return rest;
}
