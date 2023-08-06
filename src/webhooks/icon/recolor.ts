import { Icon } from "./handler.js";
import { recolorPng } from "./recolorPng.js";
import { recolorSVG } from "./recolorSvg.js";

export async function recolor(icon: Icon, hexColor?: string): Promise<Icon> {
  console.log("recolor", hexColor);
  if (!hexColor) {
    console.log("recolor not needed");
    return icon;
  }
  if (icon.contentType === "image/png") {
    console.log("Recoloring PNG");
    return { ...icon, data: await recolorPng(icon.data, hexColor) };
  } else if (icon.contentType === "image/svg+xml") {
    console.log("Recoloring SVG");
    return { ...icon, data: await recolorSVG(icon.data, hexColor) };
  } else {
    throw new Error("Unsupported content type: " + icon.contentType);
  }
}


