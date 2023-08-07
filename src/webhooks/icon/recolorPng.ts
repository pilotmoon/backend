import { createWriteStream, ReadStream } from "node:fs";
import { PNG } from "pngjs";

export async function recolorPng(buffer: ArrayBuffer, hexColor: string): Promise<ArrayBuffer> {
  const color = parseHexColor(hexColor);
  console.log('Recoloring PNG to:', color);
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

// note we expect pre-validated 6-digit hex color with hash e.g. #ffffff
function parseHexColor(hex: string) {
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return { r, g, b };
}
