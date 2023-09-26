import { calculateIconKey, Icon, IconDescriptor, IconFactory } from "./icon.js";
import { ApiError } from "../../errors.js";
import { log } from "../../logger.js";
import { LRUCache } from "lru-cache";
import { getIconHttp } from "./geticonHttp.js";
import { getIconPopClip } from "./getIconPopClip.js";
import { getIconIconify } from "./getIconIconify.js";
import { postprocess } from "./postprocess.js";
import er from "emoji-regex";

const specifierRegex = /^([a-z]{2,10}):(.+)$/i;
const textIconRegex = /^((?:[a-z]{2,10} +)*)(\S{1,3}|\S \S)$/i;
const emojiRegex = er();

const cachedIcons = new LRUCache<string, Icon>({
  maxSize: 5_000_000,
  sizeCalculation: (icon) => icon.data.byteLength,
});

const factories: Record<string, IconFactory> = {
  http: (descriptor) => getIconHttp(descriptor, { postprocess }),
  https: (descriptor) => getIconHttp(descriptor, { postprocess }),
  bundle: getIconPopClip,
  symbol: getIconPopClip,
  text: getIconPopClip,
  svg: getIconPopClip,
  data: getIconPopClip,
  iconify: getIconIconify,
};

export async function getIcon(
  descriptor: IconDescriptor,
): Promise<{ icon: Icon; key: string }> {
  console.time("getIcon");
  // check cache
  const key = calculateIconKey(descriptor);
  const cached = cachedIcons.get(key);
  if (cached) {
    log("Using cached icon");
    console.timeEnd("getIcon");
    return { icon: cached, key };
  }

  // look for prefix:subspecifier first
  let icon: Icon | undefined;
  const parts = descriptor.specifier.match(specifierRegex);
  if (parts) {
    for (const [prefix, factory] of Object.entries(factories)) {
      if (parts[1] === prefix) {
        console.log("Using factory", prefix, factory);
        icon = await factory(descriptor);
        break;
      }
    }
  }

  // fallback to popclip if input looks sane
  if (!icon && (textIconRegex.test(descriptor.specifier) || emojiRegex.test(descriptor.specifier))) {
    console.log("Using PopClip");
    icon = await getIconPopClip(descriptor);
  }

  // if we still don't have an icon, throw
  if (!icon) {
    throw new ApiError(400, "No icon for specifier");
  }

  // cache and return
  cachedIcons.set(key, icon);
  console.timeEnd("getIcon");
  return { icon, key };
}
