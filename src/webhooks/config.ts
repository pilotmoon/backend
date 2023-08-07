import { decimalIntegerTransform, loadConfig } from "../loadConfig.js";
import axios, { AxiosInstance } from "axios";
import { log } from "../logger.js";

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
  S3_CONFIG: string
}
const manifestStatic = [
  { key: "TWIX_PORT", transform: decimalIntegerTransform },
  {
    key: "COMMIT_HASH",
    optional: true,
    transform: (val: any) => val.length === 40 ? val : "?".repeat(40),
  },
  { key: "ROLO_URL" },
  { key: "ROLO_URL_CANONICAL" },
  { key: "ROLO_APIKEY_TEST", hidden: true },
  { key: "ROLO_APIKEY_LIVE", hidden: true },
  { key: "TWIX_APIKEYS", hidden: true },
];
const manifestDynamic = [
  { key: "S3_CONFIG", loader: regLoader, hidden: true },
  { key: "PADDLE_CREDENTIALS", loader: regLoader, hidden: true },
];

export const config = loadConfig<Config>(manifestStatic);

// we put rolo here because it's bound up with config loading
export function getRolo(kind: "test" | "live"): AxiosInstance {
  let apiKey;
  if (kind === "test") {
    apiKey = config.ROLO_APIKEY_TEST;
  } else if (kind === "live") {
    apiKey = config.ROLO_APIKEY_LIVE;
  } else {
    throw new Error(`Invalid kind '${kind}'`);
  }
  return axios.create({
    baseURL: config.ROLO_URL,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });
}


log("Waiting for API server".green);

let done = false;
while (!done) {
try {
  await getRolo("live").get("/");
  done=true;
} catch {
  log("API server not up yet");
  await new Promise(resolve => setTimeout(resolve, 1000));
}
}

log("Loading remote config".green);
async function loadRecord(registry: string, obj: string) {
  return JSON.stringify((await getRolo("live").get(`registries/${registry}/objects/${obj}`)).data.record)
}
const dynConfig: Record<string, string> = {
  S3_CONFIG: await loadRecord("s3_cdn", "config"),
  PADDLE_CREDENTIALS: await loadRecord("paddle", "credentials")
};

function regLoader(key: string): string | undefined {
  return dynConfig[key];
}

Object.assign(config, loadConfig(manifestDynamic));
