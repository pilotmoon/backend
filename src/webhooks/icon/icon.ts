import { z } from "zod";
import { sha256 } from 'js-sha256';
import { baseEncode, alphabets } from '@pilotmoon/chewit';

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
  prefix: string,
  subspecifier: string,
) => Promise<Icon>;

export function parseIconDescriptor(descriptor: unknown) {
  const parsed = ZIconDescriptor.parse(descriptor);
  if (parsed.scale) {
    parsed.scale = Math.min(Math.max(parsed.scale, 0.1), 9.9);
  }
  return parsed;
}

export function calculateIconKey(descriptor: IconDescriptor) {
  const hash = sha256.create().update(descriptor.specifier).array();
  let key = 'i' + baseEncode(hash, alphabets.base58Flickr).slice(-11);
  if (descriptor.flipHorizontal) {
      key += "h";
  }
  if (descriptor.flipVertical) {
      key += "v";
  }
  if (descriptor.preserveAspect) {
      key += "a";
  }
  if (descriptor.preserveColor) {
      key += "c";
  }
  if (descriptor.scale) {
      key += "s" + Math.round(descriptor.scale*100);
  }
  if (descriptor.color) {
      key += `-${descriptor.color.slice(1)}`;
  }
  return key;
}