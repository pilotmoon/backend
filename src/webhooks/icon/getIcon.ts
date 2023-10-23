import { IconDescriptor, querifyDescriptor } from "./iconDescriptor.js";
import { Icon, IconFactory } from "./iconFactory.js";
import { ApiError } from "../../errors.js";
import { log } from "../../logger.js";
import { getIconHttp } from "./getIconFetch.js";
import { getIconPopClip } from "./getIconPopClip.js";
import { getIconIconify } from "./getIconIconify.js";
import { postprocess } from "./postprocess.js";
import makeEmojiRejex from "emoji-regex";

const specifierRegex = /^([a-z]{2,10}):(.+)$/i;
const textIconRegex = /^((?:[a-z]{2,10} +)*)(\S{1,3}|\S \S)$/i;
const emojiRegex = makeEmojiRejex();

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
): Promise<Icon> {
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
  
  return icon;
}
