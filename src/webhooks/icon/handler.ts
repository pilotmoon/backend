import { ReadStream } from "fs";

export interface Icon {
  data: ArrayBuffer;
  contentType: "image/png" | "image/svg+xml" | string;
}

export type IconFactory = (prefix: string, subspecifier: string) => Promise<Icon>

