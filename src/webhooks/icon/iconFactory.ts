import {
  calculateIconKey,
  Icon,
  IconDescriptor,
  IconFactory,
} from "./icon.js";
import { ApiError } from "../../errors.js";
import { log } from "../../logger.js";
import { LRUCache } from "lru-cache";
import { getIcon as getIconHttps } from "./iconFactoryHttps.js";
import { getIcon as getIconPopClip } from "./iconFactoryPopClip.js";

const specifierRegex = /^([a-z]{2,10}):(.+)$/i;
const textIconRegex = /^((?:[a-z]{2,10} +)*)(\S{1,3}|\S \S)$/i;

const cachedIcons = new LRUCache<string, Icon>({
  maxSize: 5_000_000,
  sizeCalculation: (icon) => icon.data.byteLength,
});

function notImplemented(
  _descriptor: IconDescriptor,
  _prefix: string,
  _subspecifier: string,
): Promise<Icon> {
  throw new ApiError(501, "Not implemented");
}

const factories: Record<string, IconFactory> = {
  https: getIconHttps,
  bundle: getIconPopClip,
  symbol: getIconPopClip,
  text: getIconPopClip,
  svg: getIconPopClip,
  iconify: notImplemented,
  id: notImplemented
};

export async function getIcon(
  descriptor: IconDescriptor,
): Promise<{ icon: Icon; key: string }> {
  // check cache
  const key = calculateIconKey(descriptor);
  const cached = cachedIcons.get(key);
  if (cached) {
    log("Using cached icon");
    return { icon: cached, key };
  }

  // look for prefix:subspecifier first
  let icon: Icon | undefined;
  const parts = descriptor.specifier.match(specifierRegex);
  if (parts) {
    for (const [prefix, factory] of Object.entries(factories)) {
      if (parts[1] === prefix) {        
        console.log("Using factory", prefix, factory);
        icon = await factory(descriptor, prefix, parts[2]);
        break;
      }
    }
  } 

  // fallback to popclip if input looks sane
  if (!icon&&(parts||textIconRegex.test(descriptor.specifier))) {
    console.log("Using PopClip");
    icon = await getIconPopClip(descriptor, "", "");
  }
  
  // if we still don't have an icon, throw
  if (!icon) {
    throw new ApiError(400, "No icon for specifier");
  }
  
  // cache and return
  cachedIcons.set(key, icon);
  return { icon, key };
}
