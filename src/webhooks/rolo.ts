import axios, { AxiosInstance } from "axios";
import { config } from "./config.js";

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
