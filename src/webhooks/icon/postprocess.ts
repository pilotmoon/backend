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
  // process icons with transformations externally
  if (
    descriptor.flipHorizontal || descriptor.flipVertical || descriptor.scale
  ) {
    const data = Buffer.from(icon.data).toString("base64");
    const dataUrl = `data:${icon.contentType};base64,${data}`;
    icon = await getIconPopClip({
      ...descriptor,
      specifier: dataUrl,
      intrinsicColor: icon.colorMode === "intrinsic",
    } as IconDescriptor);
  } else {
    if (icon.colorMode === "mask" && !descriptor.preserveColor) {
      icon = await recolor(icon, descriptor.color ?? "#000000");
    }
  }
  return icon;
}
