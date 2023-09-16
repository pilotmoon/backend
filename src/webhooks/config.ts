import { decimalIntegerTransform, loadConfig } from "../loadConfig.js";

// app configuration
export interface Config {
  TWIX_PORT: number;
  COMMIT_HASH: string;
  PADDLE_CREDENTIALS: string;
  ROLO_URL: string;
  ROLO_URL_CANONICAL: string;
  ROLO_APIKEY_TEST: string;
  ROLO_APIKEY_LIVE: string;
  TWIX_APIKEYS: string;
  SPACES_CONFIG: string;
  SMTP_CONFIG: string;
  REPORTS_CONFIG: string;
}
export const config = loadConfig<Config>([
  { key: "TWIX_PORT", transform: decimalIntegerTransform },
  {
    key: "COMMIT_HASH",
    optional: true,
    transform: (val) => val.length === 40 ? val : "?".repeat(40),
  },
  { key: "PADDLE_CREDENTIALS", hidden: true },
  { key: "ROLO_URL" },
  { key: "ROLO_URL_CANONICAL" },
  { key: "ROLO_APIKEY_TEST", hidden: true },
  { key: "ROLO_APIKEY_LIVE", hidden: true },
  { key: "TWIX_APIKEYS", hidden: true },
  { key: "SPACES_CONFIG", hidden: true },
  { key: "SMTP_CONFIG", hidden: true },
  { key: "REPORTS_CONFIG", hidden: true },
]);
