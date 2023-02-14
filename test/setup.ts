import axios, { AxiosInstance } from "axios";
import { deterministic, randomIdentifier, randomKey } from "../src/identifiers";
import { config } from "../src/config";

let roloInstance: AxiosInstance;
let keyStore: { [key: string]: { id: string; key: string } };

export function keys() {
  if (!keyStore) {
    keyStore = {};
    for (const name of ["runner", "noscope", "subject"]) {
      deterministic(() => {
        keyStore[name] = randomKey("test", "ak");
      });
    }
    console.log("Created keyStore", keyStore);
  }
  return keyStore;
}

export function rolo() {
  if (!roloInstance) {
    console.log("CREATING ROLO INSTANCE");
    roloInstance = axios.create({
      baseURL: config.APP_TEST_URL,
      headers: {
        "Authorization": `Bearer ${(keys()).runner.key}`,
      },
      validateStatus: () => true, //
    });
  }
  return roloInstance;
}
