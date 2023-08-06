import { Icon } from "./handler.js";
import { recolorPng } from "./recolorPng.js";
import { recolorSVG } from "./recolorSvg.js";

export async function recolor(icon: Icon, color: string): Promise<Icon> {
  console.log("recolor", color);
  if (icon.contentType === "image/png") {
    console.log("Recoloring PNG");
    return { ...icon, data: await recolorPng(icon.data, color) };
  } else if (icon.contentType === "image/svg+xml") {
    console.log("Recoloring SVG");
    return { ...icon, data: await recolorSVG(icon.data, color) };
  } else {
    throw new Error("Unsupported content type: " + icon.contentType);
  }
}


