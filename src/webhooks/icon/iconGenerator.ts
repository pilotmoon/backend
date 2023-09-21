import { Icon, IconFactory, HexColor } from "./handler.js";
import { ApiError } from "../../errors.js";
import { recolor } from "./recolor.js";
import { log } from "../../logger.js";
import { z } from "zod";
import { LRUCache } from "lru-cache";
import { getIcon as getIconHttps } from "./handlerHttps.js";
import { sha256Hex } from "../../sha256.js";

const cachedIcons = new LRUCache<string, Icon>({
  maxSize: 5_000_000,
  sizeCalculation: (icon) => icon.data.byteLength,
});

const handlers: Record<string, IconFactory> = {
  https: getIconHttps,
};

const specifierRegex = /^([0-9a-z]+):(.+)$/;
const colorRegex=/^#[0-9a-f]{6}$/;
const ZIconDescriptor = z.object({
  specifier: z.string().regex(specifierRegex),
  color: z.string().regex(colorRegex).optional()
});
export type IconDescriptor = { specifier: string, color?: HexColor }
export function parseIconDescriptor(descriptor: unknown): IconDescriptor {
  return ZIconDescriptor.parse(descriptor) as IconDescriptor;
}

export async function generateIcon({ specifier, color }: IconDescriptor): Promise<Icon> {
  // check cache
  const key = sha256Hex(specifier + (color || "#"));
  const cached = cachedIcons.get(key);
  if (cached) {
    log("Using cached icon");
    return cached;
  }  

  // parse the specifier
  const match = specifierRegex.exec(specifier);
  if (!match) {
    throw new ApiError(404, "Invalid specifier: " + specifier);
  }
  const [, prefix, subspecifier] = match;

  // get the icon
  const handler = handlers[prefix];
  if (!handler) {
    throw new ApiError(404, "Unknown prefix: " + prefix);
  }
  const icon = await handler(prefix, subspecifier, color);

  // cache and return
  cachedIcons.set(key, icon);
  return icon
}
