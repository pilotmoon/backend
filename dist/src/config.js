"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
// app configuration
exports.config = {};
// define config variables
const manifest = [
  { key: "APP_PORT", transform: decimalIntegerTransform },
  { key: "APP_URL" },
  { key: "DATABASE_URL", secret: true },
  { key: "DATABASE_NAME", loader: load("testdb") },
];
// load config variables
manifest.forEach(setConfigItem);
// loader to read from process.env
function envLoader(key) {
  return process.env[key];
}
// construct a loader that always returns the same value
function load(value) {
  return () => value;
}
// identity
function noTransform(string) {
  return string;
}
// parse a string as a decimal integer
function decimalIntegerTransform(string) {
  return parseInt(string, 10);
}
function setConfigItem(
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
      secret ? "<secret>".yellow : String(transformedValue).cyan
    } as ${typeof transformedValue}`,
  );
  exports.config[key] = transformedValue;
}
