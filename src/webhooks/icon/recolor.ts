import { Icon, HexColor } from "./icon.js";
import { recolorPng } from "./recolorPng.js";
import { recolorSvg } from "./recolorSvg.js";

export async function recolor(icon: Icon, color: HexColor ): Promise<Icon> {
  console.time("recolor"+color);
  let result: Icon;
  if (icon.contentType === "image/png") {
    console.log("Recoloring PNG");
    result = { ... icon, data: await recolorPng(icon.data, color) };
  } else if (icon.contentType === "image/svg+xml") {
    console.log("Recoloring SVG");
    result = { ...icon, data: await recolorSvg(icon.data, color) };
  } else {
    throw new Error("Unsupported content type: " + icon.contentType);
  }
  console.timeEnd("recolor"+color);
  return result;
}


