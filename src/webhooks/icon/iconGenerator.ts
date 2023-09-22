import { Icon, IconFactory } from "./handler.js";
import { ApiError } from "../../errors.js";
import { log } from "../../logger.js";
import { z } from "zod";
import { LRUCache } from "lru-cache";
import { getIcon as getIconHttps } from "./handlerHttps.js";
import { calculateIconKey } from "./iconKey.js";

const cachedIcons = new LRUCache<string, Icon>({
  maxSize: 5_000_000,
  sizeCalculation: (icon) => icon.data.byteLength,
});

const handlers: Record<string, IconFactory> = {
  https: getIconHttps,
};

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

export async function generateIcon(
  descriptor: IconDescriptor,
): Promise<{ icon: Icon; key: string }> {
  // check cache
  const key = calculateIconKey(descriptor);
  const cached = cachedIcons.get(key);
  if (cached) {
    log("Using cached icon");
    return { icon: cached, key }
  }

  // parse the specifier
  const match = specifierRegex.exec(descriptor.specifier);
  if (!match) {
    throw new ApiError(404, "Invalid specifier: " + descriptor.specifier);
  }
  const [, prefix, subspecifier] = match;

  // get the icon
  const handler = handlers[prefix];
  if (!handler) {
    throw new ApiError(404, "Unknown prefix: " + prefix);
  }
  const icon = await handler(prefix, subspecifier, descriptor.color);

  // cache and return
  cachedIcons.set(key, icon);
  return { icon, key };
}
