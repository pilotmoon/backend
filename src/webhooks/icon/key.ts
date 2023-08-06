
export function canonicalizeColor(color: any): string | undefined {
  if (typeof color === "string") {
    color = color.trim();
    color = color.toLowerCase();
    if (color === 'black') {
      return '#000000';
    }
    if (color === 'white') {
      return '#ffffff';
    }
    if (color.startsWith("#")) {
      color = color.substring(1);
    }
    if (color.match(/^[0-9a-f]{6}$/i)) {
      return '#' + color;
    }
    if (color.match(/^[0-9a-f]{3}$/i)) {
      return "#" + color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
    }
  }
}
