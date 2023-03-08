import axios, { AxiosInstance } from "axios";
import { deterministic, randomKey } from "../../src/api/identifiers.js";
import { config } from "../../src/api/config.js";

export type TestKey = typeof testKeys[keyof typeof testKeys];
export const testKeys = {
  runner: {
    scopes: ["*"],
    expires: new Date(Date.now() + 60 * 60 * 1000),
    description: "test all-scopes runner key (deterministically generated)",
  },
  expired: {
    scopes: ["*"],
    // date 1 hour in the past
    expires: new Date(Date.now() - 60 * 60 * 1000),
    description: "test expired key (deterministically generated)",
  },
  noscope: {
    scopes: [],
    description: "test no-scopes key (deterministically generated)",
  },
  subject: {
    scopes: ["health:read"],
    description: "test subject key (deterministically generated)",
  },
  updateonly: {
    scopes: ["apiKeys:update", "registries:update"],
    description: "test update-only key (deterministically generated)",
  },
  readonly: {
    scopes: ["apiKeys:read", "registries:read"],
    description: "test read-only key (deterministically generated)",
  },
  createLicenseKey: {
    scopes: ["licenseKeys:create"],
    description: "test createLicenseKey key (deterministically generated)",
  },
};

const instances = new Map<string, AxiosInstance>();
type KeyName = [keyof typeof testKeys][number];
let keyStore: Record<KeyName, { id: string; key: string }>;
export function keys() {
  if (!keyStore) {
    keyStore = {} as any;
    for (const keyName of Object.keys(testKeys) as KeyName[]) {
      deterministic(() => {
        keyStore[keyName] = randomKey("test", "ak");
      });
    }
    console.log("Created keyStore", keyStore);
  }
  return keyStore;
}

export function rolo(keyName: KeyName = "runner"): AxiosInstance {
  let instance = instances.get(keyName);
  if (!instance) {
    instance = axios.create({
      baseURL: config.APP_TEST_URL,
      headers: {
        "Authorization": `Bearer ${(keys())[keyName].key}`,
      },
      validateStatus: () => true, //
    });
    instances.set(keyName, instance);
  }
  return instance;
}
