import { decimalIntegerTransform, loadConfig } from "../loadConfig.js";

// app configuration
export interface Config {
  TWIX_PORT: number;
  COMMIT_HASH: string;
  PADDLE_PUBKEY_SANDBOX: string;
  PADDLE_PUBKEY_PRODUCTION: string;
  ROLO_URL: string;
  ROLO_URL_CANONICAL: string;
  ROLO_APIKEY_TEST: string;
  ROLO_APIKEY_LIVE: string;
}
export const config = loadConfig<Config>([
  { key: "TWIX_PORT", transform: decimalIntegerTransform },
  {
    key: "COMMIT_HASH",
    optional: true,
    transform: (val) => val.length === 40 ? val : "?".repeat(40),
  },
  { key: "PADDLE_PUBKEY_SANDBOX", hidden: true },
  { key: "PADDLE_PUBKEY_PRODUCTION", hidden: true },
  { key: "ROLO_URL" },
  { key: "ROLO_URL_CANONICAL" },
  { key: "ROLO_APIKEY_TEST", hidden: true },
  { key: "ROLO_APIKEY_LIVE", hidden: true },
]);
