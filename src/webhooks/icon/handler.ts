export type HexColor = string;

export interface Icon {
  data: ArrayBuffer;
  contentType: "image/png" | "image/svg+xml" | string;
  intrinsicPreserveColor: boolean;
}

export type IconFactory = (prefix: string, subspecifier: string, color?: HexColor) => Promise<Icon>

