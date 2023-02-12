import { log, logw } from "./logger";
import { repeat } from "lodash";

// app configuration
interface Config {
  APP_PORT: number;
  APP_URL: string;
  DATABASE_URL: string;
  DATABASE_NAME_TEST: string;
  DATABASE_NAME_LIVE: string;
  COMMIT_HASH: string;
  BOOTSTRAP_SEED: string;
  ACCESS_WHITELIST: string[];
}
export const config = loadConfig([
  { key: "APP_PORT", transform: decimalIntegerTransform },
  { key: "APP_URL" },
  { key: "DATABASE_URL", secret: true },
  { key: "DATABASE_NAME_TEST" },
  { key: "DATABASE_NAME_LIVE" },
  { key: "BOOTSTRAP_SEED" },
  {
    key: "COMMIT_HASH",
    optional: true,
    transform: (val) => val.length === 40 ? val : repeat("?", 40),
  },
  { key: "ACCESS_WHITELIST", transform: commaListTransform, optional: true },
]);

// load config variables
function loadConfig(manifest: ConfigItem[]) {
  const config = {};
  for (const item of manifest) {
    setConfigItem(item, config);
  }
  return config as Config;
}

/* Helpers */
interface ConfigItem {
  key: string;
  loader?: Loader;
  transform?: Transformer;
  secret?: boolean;
  optional?: boolean;
}

interface Loader {
  (key: string): string | undefined;
}
// loader to read from process.env
function envLoader(key: string) {
  return process.env[key];
}
// construct a loader that always returns the same value
function load(value: any) {
  return () => value;
}

interface Transformer {
  (value: string): any;
}
// identity
function noTransform(string: string) {
  return string;
}
// parse a string as a decimal integer
function decimalIntegerTransform(string: string) {
  return parseInt(string, 10);
}
function commaListTransform(string: string) {
  if (!string) {
    return [];
  }
  return string.split(",").map((item) => item.trim());
}

function setConfigItem(
  {
    key,
    loader = envLoader,
    transform = noTransform,
    secret = false,
    optional = false,
  }: ConfigItem,
  config: any,
) {
  let value = loader(key);
  if (typeof value !== "string") {
    if (optional) {
      logw("Missing environment variable: " + key);
    } else {
      throw new Error("Missing environment variable: " + key);
    }
    value = "";
  }
  const transformed = transform(value);
  log(
    `Loaded config variable ${key.blue} with value ${
      secret ? "<secret>".yellow : JSON.stringify(transformed).cyan
    }`,
  );
  config[key] = transformed;
}
