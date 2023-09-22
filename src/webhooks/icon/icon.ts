import { z } from "zod";

export type HexColor = string;

const specifierRegex = /^([0-9a-z]+):(.+)$/;
const colorRegex = /^#[0-9a-f]{6}$/;
const ZIconDescriptor = z.object({
  specifier: z.string().regex(specifierRegex),
  flipHorizontal: z.boolean().optional(),
  flipVertical: z.boolean().optional(),
  preserveColor: z.boolean().optional(),
  preserveAspect: z.boolean().optional(),
  scale: z.number().optional(),
  color: z.string().regex(colorRegex).optional(),
});

export type IconDescriptor = z.infer<typeof ZIconDescriptor>;
export function parseIconDescriptor(descriptor: unknown) {
  const parsed = ZIconDescriptor.parse(descriptor);
  if (parsed.scale) {
    parsed.scale = Math.min(Math.max(parsed.scale, 0.1), 9.9);
  }
  return parsed;
}
export function splitSpecifier(descriptor: IconDescriptor) {
  const [, prefix, subspecifier] = descriptor.specifier.match(specifierRegex)!;
  return { prefix, subspecifier };
}

export interface Icon {
  data: ArrayBuffer;
  contentType: "image/png" | "image/svg+xml" | string;
  intrinsicColor: boolean;
}

export type IconFactory = (
  descriptor: IconDescriptor,
  prefix: string,
  subspecifier: string,
) => Promise<Icon>;

