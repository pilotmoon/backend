import { z } from "zod";
import { log } from "../../logger.js";
import { sha256Base64Url } from "../../sha256.js";

export const ZIconDescriptor = z.object({
  specifier: z.string(),
  color: z.string().optional(),
});

export type IconDescriptor = z.infer<typeof ZIconDescriptor>;

export function generateKey(descriptor: IconDescriptor): string {
  const descriptorString = JSON.stringify(descriptor);
  log("descriptorString: " + descriptorString);
  return sha256Base64Url(descriptorString).substring(0, 24);
}

export function canonicalize(
  descriptor: IconDescriptor,
): IconDescriptor  {
  return { ...descriptor, color: canonicalizeColor(descriptor.color) };
}

function canonicalizeColor(color: any): string | undefined {
  if (typeof color === "string") {
    color = color.trim();
    color = color.toLowerCase();
    if (color === "black") {
      return "#000000";
    }
    if (color === "white") {
      return "#ffffff";
    }
    if (color.startsWith("#")) {
      color = color.substring(1);
    }
    if (color.match(/^[0-9a-f]{6}$/i)) {
      return "#" + color;
    }
    if (color.match(/^[0-9a-f]{3}$/i)) {
      return "#" + color[0] + color[0] + color[1] + color[1] + color[2] +
        color[2];
    }
  }
}
