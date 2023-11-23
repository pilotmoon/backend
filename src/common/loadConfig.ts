import { log, logw } from "./log.js";

export function loadConfig<T>(manifest: ConfigItem[]): T {
  const config = {};
  for (const item of manifest) {
    setConfigItem(item, config);
  }
  return config as T;
}

interface ConfigItem {
  key: string;
  loader?: Loader;
  transform?: Transformer;
  hidden?: boolean;
  optional?: boolean;
}
type Loader = (key: string) => string | undefined;

// loader to read from process.env
function envLoader(key: string) {
  return process.env[key];
}

// transform a string into another type
type Transformer = (value: string) => unknown;

// parse a string as a decimal integer
export function decimalIntegerTransform(string: string) {
  return parseInt(string, 10);
}

// print ? x40 if the string is not 40 characters long
export function sha1PrettyTransform(val: string) {
  return val.length === 40 ? val : "?".repeat(40);
}

// actually set the config item
function setConfigItem(
  {
    key,
    loader = envLoader,
    transform,
    hidden = false,
    optional = false,
  }: ConfigItem,
  config: Record<string, unknown>,
) {
  let value = loader(key);
  if (typeof value !== "string") {
    if (optional) {
      logw(
        `Substituting empty string for missing environment variable: ${key}`,
      );
    } else {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    value = "";
  }
  value = value.trim();
  const transformed = transform ? transform(value) : value;
  log(
    `Loaded config variable ${key.blue} with value ${
      hidden ? "<hidden>".yellow : JSON.stringify(transformed).cyan
    }`,
  );
  config[key] = transformed;
}
