import { Icon, IconDescriptor } from "./icon.js";
import { recolor } from "./recolor.js";
import { getIconPopClip } from "./getIconPopClip.js";

export async function postprocess(
  icon: Icon,
  descriptor: IconDescriptor,
): Promise<Icon> {
  // process PNGs and SVGs with transformations externally
  if (
    icon.contentType === "image/png" || descriptor.flipHorizontal ||
    descriptor.flipVertical || descriptor.scale
  ) {
    const data = Buffer.from(icon.data).toString("base64");
    const dataUrl = `data:${icon.contentType};base64,${data}`;
    icon = await getIconPopClip({
      ...descriptor,
      specifier: dataUrl,
      intrinsicColor: icon.colorMode === "intrinsic",
    } as IconDescriptor);
  } else if (icon.contentType === "image/svg+xml") {
    if (icon.colorMode === "mask" && !descriptor.preserveColor) {
      icon = await recolor(icon, descriptor.color ?? "#000000");
    }
  }
  return icon;
}
