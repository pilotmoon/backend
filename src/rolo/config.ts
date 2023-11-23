import { decimalIntegerTransform, loadConfig } from "../loadConfig.js";

// app configuration
export interface Config {
  ROLO_PORT: number;
  DATABASE_URL: string;
  DATABASE_NAME: string;
  BOOTSTRAP_SEED: string;
  APP_SECRET: string;
  COMMIT_HASH: string;
}
export const config = loadConfig<Config>([
  { key: "ROLO_PORT", transform: decimalIntegerTransform },
  { key: "DATABASE_URL", hidden: true },
  { key: "DATABASE_NAME" },
  { key: "APP_SECRET", hidden: true, optional: true },
  { key: "BOOTSTRAP_SEED" },
  {
    key: "COMMIT_HASH",
    optional: true,
    transform: (val) => (val.length === 40 ? val : "?".repeat(40)),
  },
]);
