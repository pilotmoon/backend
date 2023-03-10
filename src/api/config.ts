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
  APP_SECRET_TEST: string;
  APP_SECRET_LIVE: string;
  COMMIT_HASH: string;
  BOOTSTRAP_SEED: string;
  ACCESS_ALLOWLIST: string[];
  APP_TEST_URL: string;
}
export const config = loadConfig<Config>([
  { key: "APP_PORT", transform: decimalIntegerTransform },
  { key: "DATABASE_URL", secret: true },
  { key: "DATABASE_NAME_TEST" },
  { key: "DATABASE_NAME_LIVE" },
  { key: "DATABASE_NAME_LOGS" },
  { key: "APP_SECRET_TEST", secret: true },
  { key: "APP_SECRET_LIVE", secret: true, optional: true },
  { key: "BOOTSTRAP_SEED" },
  {
    key: "COMMIT_HASH",
    optional: true,
    // repeat ? character 4 times
    transform: (val) => val.length === 40 ? val : "?".repeat(40),
  },
  { key: "ACCESS_ALLOWLIST", transform: commaListTransform, optional: true },
  { key: "APP_TEST_URL", optional: true },
]);
