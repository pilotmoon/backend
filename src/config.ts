// app configuration
export const config: { [key: string]: any } = {};

// define config variables
const manifest = [
  { key: "APP_PORT", transform: decimalIntegerTransform },
  { key: "APP_URL" },
  { key: "PATH_PREFIX", loader: load("/v1") },
  { key: "DATABASE_URL", secret: true },
  { key: "DATABASE_NAME", loader: load("testdb") },
];

// load config variables
manifest.forEach(setConfigItem);

/* Helper functions */

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

function setConfigItem(
  { key, loader = envLoader, transform = noTransform, secret = false }: {
    key: string;
    loader?: Loader;
    transform?: Transformer;
    secret?: boolean;
  },
) {
  const value = loader(key);
  if (typeof value !== "string") {
    throw new Error("Missing environment variable: " + key);
  }
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    throw new Error("Empty environment variable: " + key);
  }
  const transformedValue = transform(trimmedValue);
  console.log(
    `Loaded config variable ${key.blue} with value ${
      secret ? "<secret>".yellow : String(transformedValue).cyan
    } as ${typeof transformedValue}`,
  );
  config[key] = transformedValue;
}
