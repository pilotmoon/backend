import {
  commaListTransform,
  decimalIntegerTransform,
  loadConfig,
} from "../loadConfig.js";

// app configuration
export interface Config {
  APP_PORT: number;
  DATABASE_URL: string;
  DATABASE_NAME_TEST: string;
  DATABASE_NAME_LIVE: string;
  DATABASE_NAME_LOGS: string;
  APP_SECRET: string;
  COMMIT_HASH: string;
  BOOTSTRAP_SEED: string;
  ACCESS_ALLOWLIST: string[];
  APP_TEST_URL: string;
}
export const config = loadConfig<Config>([
  { key: "APP_PORT", transform: decimalIntegerTransform },
  { key: "DATABASE_URL", hidden: true },
  { key: "DATABASE_NAME_TEST" },
  { key: "DATABASE_NAME_LIVE" },
  { key: "DATABASE_NAME_LOGS" },
  { key: "APP_SECRET", hidden: true },
  { key: "BOOTSTRAP_SEED" },
  {
    key: "COMMIT_HASH",
    optional: true,
    transform: (val) => (val.length === 40 ? val : "?".repeat(40)),
  },
  { key: "ACCESS_ALLOWLIST", transform: commaListTransform, optional: true },
  { key: "APP_TEST_URL", optional: true },
]);
