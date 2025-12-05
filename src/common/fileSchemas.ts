import { z } from "zod";
import { NonNegativeSafeInteger } from "./saneSchemas.js";

function isValidSegment(segment: string) {
  return (
    !!segment &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("\\") &&
    !segment.includes("\0")
  );
}

export const ZFileName = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((val) => !val.endsWith("/"), {
    message: "File name cannot end with '/'",
  })
  .refine((val) => !val.startsWith("/"), {
    message: "File name cannot start with '/'",
  })
  .refine((val) => !val.includes("//"), {
    message: "File name cannot contain '//' sequences",
  })
  .refine((val) => val.split("/").every((segment) => isValidSegment(segment)), {
    message: "File name contains invalid path segments",
  });

export const ZFileRecord = z.object({
  _id: z.string(),
  object: z.literal("file"),
  name: ZFileName,
  size: NonNegativeSafeInteger,
  hidden: z.boolean().optional(),
  created: z.date(),
});
export type FileRecord = z.infer<typeof ZFileRecord>;

export const ZFileCreateInput = z.object({
  name: ZFileName,
});
export type FileCreateInput = z.infer<typeof ZFileCreateInput>;

export const ZFileUpdateInput = z
  .object({
    hidden: z.boolean().optional(),
  })
  .refine((val) => Object.keys(val).length > 0, {
    message: "Update requires at least one field",
  });
export type FileUpdateInput = z.infer<typeof ZFileUpdateInput>;
