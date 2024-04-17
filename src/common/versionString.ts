import { z } from "zod";

export const ZVersionString = z
  .string()
  .max(100)
  .regex(/^(?:[1-9]\d+|\d)(?:\.(?:[1-9]\d+|\d))*$/);
export type VersionString = z.infer<typeof ZVersionString>;

export function compareVersionStrings(
  a: VersionString,
  b: VersionString,
): number {
  const splitVersion = (version: string) =>
    version.split(".").map((num) => parseInt(num, 10));
  const aParts = splitVersion(a);
  const bParts = splitVersion(b);
  const length = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < length; i++) {
    const aPart = aParts[i] ?? 0;
    const bPart = bParts[i] ?? 0;
    if (aPart !== bPart) {
      return aPart < bPart ? -1 : 1;
    }
  }
  if (aParts.length < bParts.length) return -1;
  if (aParts.length > bParts.length) return 1;
  return 0;
}
