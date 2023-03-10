import { log, logw } from "./logger.js";

// load config variables
export function loadConfig<T>(manifest: ConfigItem[]): T {
  const config = {};
  for (const item of manifest) {
    setConfigItem(item, config);
  }
  return config as T;
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
function trimTransform(string: string) {
  return string.trim();
}
// parse a string as a decimal integer
export function decimalIntegerTransform(string: string) {
  return parseInt(string, 10);
}
export function commaListTransform(string: string) {
  if (!string) {
    return [];
  }
  return string.split(",").map((item) => item.trim());
}
function setConfigItem(
  {
    key,
    loader = envLoader,
    transform = trimTransform,
    secret = false,
    optional = false,
  }: ConfigItem,
  config: any,
) {
  let value = loader(key);
  if (typeof value !== "string") {
    if (optional) {
      logw(
        "Substituting empty string for missing environment variable: " + key,
      );
    } else {
      throw new Error("Missing required environment variable: " + key);
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
