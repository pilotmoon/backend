import { z } from "zod";
import { sha256 } from "js-sha256";
import { alphabets, baseEncode } from "@pilotmoon/chewit";

export type HexColor = string;

const colorRegex = /^#[0-9a-f]{6}$/;
const ZIconDescriptor = z.object({
  specifier: z.string().min(1),
  flipHorizontal: z.boolean().optional(),
  flipVertical: z.boolean().optional(),
  preserveColor: z.boolean().optional(),
  preserveAspect: z.boolean().optional(),
  scale: z.number().optional(),
  color: z.string().regex(colorRegex).optional(),
});
export type IconDescriptor = z.infer<typeof ZIconDescriptor>;

export const ZIcon = z.object({
  data: z.any(),
  contentType: z.enum(["image/png", "image/svg+xml"]),
  colorMode: z.enum(["intrinsic", "mask"]),
});
export type Icon = z.infer<typeof ZIcon>;

export type IconFactory = (
  descriptor: IconDescriptor,
) => Promise<Icon>;

export function parseIconDescriptor(descriptor: unknown) {
  const parsed = ZIconDescriptor.parse(descriptor);
  if (parsed.scale) {
    parsed.scale = Math.min(Math.max(parsed.scale, 0.1), 10);
  }
  return parsed;
}

// Modifies descriptor by only including the properties that are non-default.
// This allows new properties to be added in future without changing existing keys.
function keyObject(descriptor: IconDescriptor) {
  const keyObj: IconDescriptor = {
    specifier: descriptor.specifier,
  };
  if (descriptor.flipHorizontal) {
    keyObj.flipHorizontal = true;
  }
  if (descriptor.flipVertical) {
    keyObj.flipVertical = true;
  }
  if (descriptor.preserveAspect) {
    keyObj.preserveAspect = true;
  }
  if (descriptor.preserveColor) {
    keyObj.preserveColor = true;
  }
  if (descriptor.scale) {
    keyObj.scale = descriptor.scale;
  }
  return keyObj;
}

export function calculateIconKey(descriptor: IconDescriptor) {
  const hash = sha256.create().update(JSON.stringify(keyObject(descriptor)));
  let key = "i" + baseEncode(hash.array(), alphabets.base62).slice(-13);
  if (descriptor.color) {
    key += `-${descriptor.color.slice(1)}`;
  }
  console.log("key", key);
  return key;
}
