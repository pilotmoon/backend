import { createWriteStream, ReadStream } from "node:fs";
import { PNG } from "pngjs";

export async function recolorPng(buffer: ArrayBuffer, hexColor: string): Promise<ArrayBuffer> {
  const color = parseHexColor(hexColor);
  console.log('Recoloring image to:', color);
  console.log("Input image size:", buffer.byteLength);

  const png = await readPng(Buffer.from(buffer));
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const alpha = png.data[idx + 3];
      if (alpha > 0) {
        png.data[idx] = color.r;
        png.data[idx + 1] = color.g;
        png.data[idx + 2] = color.b;
      }
    }
  }
  const outputBuffer = await writePng(png);
  console.log("Output image size:", outputBuffer.length);
  return outputBuffer;
}

function readPng(buffer: Buffer): Promise<PNG> {
  return new Promise((resolve, reject) => {
    const png = new PNG();
    png.parse(buffer, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(png);
      }
    });
  });
}

function writePng(png: PNG): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    png.on("data", (chunk) => chunks.push(chunk));
    png.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    png.pack();
  });
}

function parseHexColor(hex: string) {
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { r, g, b };
}
