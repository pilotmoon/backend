import { IconDescriptor } from "./iconDescriptor.js";
import { z } from "zod";

export const ZIcon = z.object({
  data: z.any(),
  contentType: z.enum(["image/png", "image/svg+xml"]),
  colorMode: z.enum(["intrinsic", "mask"]),
});
export type Icon = z.infer<typeof ZIcon>;

export type IconFactory = (
  descriptor: IconDescriptor,
) => Promise<Icon>;
