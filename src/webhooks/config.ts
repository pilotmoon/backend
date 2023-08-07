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
  S3_CONFIG: string;
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
  { key: "S3_CONFIG", loader: regLoader("s3_cdn", "config"), hidden: true },
  {
    key: "PADDLE_CREDENTIALS",
    loader: regLoader("paddle", "credentials"),
    hidden: true,
  },
];

export const config = await loadConfig<Config>(manifestStatic);
log("Waiting for API server".green);
await waitForRolo();
log("Loading remote config".green);
Object.assign(config, await loadConfig(manifestDynamic));

/* Support functions */

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

async function waitForRolo() {
  let done = false;
  while (!done) {
    try {
      await getRolo("live").get("/");
      done = true;
    } catch {
      log("API server not up yet");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

function regLoader(reg: string, obj: string) {
  return async (key: string) => {
    try {
      const response = await getRolo("live").get(`registries/${reg}/objects/${obj}`);
      return JSON.stringify(response.data.record);
    } catch(err) {
      log("failed loading remote config:", reg, obj);
    }
  }
}
