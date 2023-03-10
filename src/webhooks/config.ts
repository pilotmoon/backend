import { decimalIntegerTransform, loadConfig } from "../loadConfig.js";

// app configuration
export interface Config {
  TWIX_APP_PORT: number;
}
export const config = loadConfig<Config>([
  { key: "TWIX_APP_PORT", transform: decimalIntegerTransform },
]);
