import { Icon, IconDescriptor, IconFactory, splitSpecifier } from "./icon.js";
import { ApiError } from "../../errors.js";
import { log } from "../../logger.js";
import { LRUCache } from "lru-cache";
import { getIcon as getIconHttps } from "./iconFactoryHttps.js";
import { calculateIconKey } from "./iconKey.js";

const cachedIcons = new LRUCache<string, Icon>({
  maxSize: 5_000_000,
  sizeCalculation: (icon) => icon.data.byteLength,
});

const factories: Record<string, IconFactory> = {
  https: getIconHttps,
};

export async function getIcon(
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
  const { prefix, subspecifier } = splitSpecifier(descriptor);

  // get the icon
  const factory = factories[prefix];
  if (!factory) {
    throw new ApiError(404, "Unknown prefix: " + prefix);
  }
  const icon = await factory(descriptor, prefix, subspecifier);

  // cache and return
  cachedIcons.set(key, icon);
  return { icon, key };
}
