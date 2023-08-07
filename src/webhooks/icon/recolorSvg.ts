import { parse, stringify } from "svgson";

export async function recolorSVG(
  data: ArrayBuffer,
  hexColor: string,
): Promise<ArrayBuffer> {
  // get data to string
  const svgString = Buffer.from(data).toString("utf-8");
  const svg = await parse(svgString);

  // recolor everything to the hex color
  console.log("Recoloring image to:", hexColor);
  console.log(svg);

  // descend into the tree and recolor everything
  // this is based on https://github.com/mgenware/recolor-img/blob/master/src/main.ts
  // it may need testing on a range of SVGs
  function recolor(node: any) {
    // fill defaults to black
    if (node.attributes.fill !== "none") {
      node.attributes.fill = hexColor;
    }
    // stroke defaults to black
    if (node.attributes.stroke) {
      if (node.attributes.stroke !== "none") {
        node.attributes.stroke = hexColor;
      }
    }
    if (node.children) {
      node.children.forEach(recolor);
    }
  }
  recolor(svg);

  return Buffer.from(stringify(svg));
}
