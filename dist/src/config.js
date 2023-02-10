"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
// App configuration
exports.config = {};
// loader to read from process.env
const envLoader = (key) => process.env[key];
// construct a loader that always returns the same value
const load = (value) => () => value;
const noTransform = (string) => string;
const decimalIntegerTransform = (string) => parseInt(string, 10);
for (
  const key of [
    { key: "APP_PORT", transform: decimalIntegerTransform },
    { key: "APP_URL" },
    { key: "DATABASE_URL", secret: true },
    { key: "DATABASE_NAME", loader: load("testdb") },
  ]
) {
  loadEnv(key);
}
function loadEnv(
  { key, loader = envLoader, transform = noTransform, secret = false },
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
      secret ? "<secret>".red : String(transformedValue).cyan
    } as ${typeof transformedValue}`,
  );
  exports.config[key] = transformedValue;
}
