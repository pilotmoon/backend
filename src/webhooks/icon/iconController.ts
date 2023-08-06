import { getIcon as getIconHttps } from "./handlerHttps.js";
import { Icon, IconFactory } from "./handler.js";
import { ApiError } from "../../errors.js";
import { recolor } from "./recolor.js";
import { log } from "../../logger.js";

const specifierRegex = /^([0-9a-z]+):(.+)$/;
const colorRegex=/^#[0-9a-f]{6}$/;
const handlers: Record<string, IconFactory> = {
  https: getIconHttps,
};

export async function getIcon(
  specifier: string,
  color?: string,
): Promise<Icon> {
  // parse the specifier
  const match = specifierRegex.exec(specifier);
  if (!match) {
    throw new ApiError(404, "Invalid specifier: " + specifier);
  }
  const [, prefix, subspecifier] = match;

  // get the base icon
  const handler = handlers[prefix];
  if (!handler) {
    throw new ApiError(404, "Unknown prefix: " + prefix);
  }
  let icon = await handler(prefix, subspecifier);

  // apply color
  if (color) {
    log("Color specified: " + color);
    if (colorRegex.test(color)) {
      icon = await recolor(icon, color);
    } else {
      throw new ApiError(400, "Invalid color: " + color);
    }
  }

  return icon
}
