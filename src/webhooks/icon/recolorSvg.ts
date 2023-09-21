import { parse, stringify } from "svgson";

export async function recolorSvg(
  data: ArrayBuffer,
  hexColor: string,
): Promise<ArrayBuffer> {
  // get data to string
  const svgString = Buffer.from(data).toString("utf-8");
  const svg = await parse(svgString);

  // recolor everything to the hex color
  console.log("Recoloring SVG to:", hexColor);

  // descend into the tree and recolor everything
  // this is based on https://github.com/mgenware/recolor-img/blob/master/src/main.ts
  // it may need testing on a range of SVGs
  function recolor(node: any) {
    console.log("current", node.attributes);
    if (node.attributes.fill) {
      if (node.attributes.fill !== "none") {
        node.attributes.fill = hexColor;
      }
    }
    if (node.attributes.stroke) {
      if (node.attributes.stroke !== "none") {
        node.attributes.stroke = hexColor;
      }
    }
    console.log("new", node.attributes);
    if (node.children) {
      node.children.forEach(recolor);
    }
  }
  recolor(svg);
  if (svg.attributes.fill !== "none") {
    svg.attributes.fill = hexColor;
  }

  return Buffer.from(stringify(svg));
}
