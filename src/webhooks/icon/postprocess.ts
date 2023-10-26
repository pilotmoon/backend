import { Icon } from "./iconFactory.js";
import { IconDescriptor } from "./iconDescriptor.js";
import { recolor } from "./recolor.js";
import { getIconPopClip } from "./getIconPopClip.js";

export async function postprocess(
  icon: Icon,
  descriptor: IconDescriptor,
): Promise<Icon> {
  if (!(icon.data instanceof ArrayBuffer)) {
    console.log("Icon is not an array buffer");
    return icon;
  }
  if (icon.colorMode === "mask" && !descriptor.preserveColor) {
    icon = await recolor(icon, descriptor.color ?? "#000000");
  }
  return icon;
}
