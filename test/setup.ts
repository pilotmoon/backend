import axios, { AxiosInstance } from "axios";
import { deterministic, randomIdentifier } from "../src/identifiers";
let roloInstance: AxiosInstance;
let keyStore: { [key: string]: { id: string; key: string } };

export function keys() {
  if (!keyStore) {
    keyStore = {};
    for (const name of ["runner", "noscope", "subject"]) {
      deterministic(() => {
        keyStore[name] = {
          id: randomIdentifier("ak"),
          key: randomIdentifier("key_test"),
        };
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
      baseURL: process.env.APP_URL,
      headers: {
        "Authorization": `Bearer ${(keys()).runner.key}`,
      },
      validateStatus: () => true, //
    });
  }
  return roloInstance;
}
