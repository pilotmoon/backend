import { decimalIntegerTransform, loadConfig } from "../loadConfig.js";

// app configuration
export interface Config {
  TWIX_PORT: number;
  COMMIT_HASH: string;
}
export const config = loadConfig<Config>([
  { key: "TWIX_PORT", transform: decimalIntegerTransform },
  {
    key: "COMMIT_HASH",
    optional: true,
    transform: (val) => val.length === 40 ? val : "?".repeat(40),
  },
]);
