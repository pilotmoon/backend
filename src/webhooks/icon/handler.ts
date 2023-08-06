import { ReadStream } from "fs";

export interface Icon {
  data: ArrayBuffer;
  contentType: "image/png" | "image/svg+xml" | string;
}

export type IconFactory = (specifier: string) => Promise<Icon>

