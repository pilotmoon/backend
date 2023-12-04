import { z } from "zod";
import { config } from "./config.js";
import { log, loge } from "../common/log.js";

const ZRecordWrapper = z.object({
  object: z.literal("record"),
  record: z.record(z.unknown()),
});

export async function waitForRemoteConfigServer(): Promise<void> {
  log("Waiting for config server...".green);
  while (true) {
    const response = await fetch(`${config.ROLO_URL_CANONICAL}/`, {
      method: "GET",
    });
    if (response.status === 200) {
      break;
    }
    // Wait for a second before retrying
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  log("Config server is available".green);
  return;
}

export async function getRemoteConfig(object: string) {
  await waitForRemoteConfigServer();
  const response = await fetch(
    `${config.ROLO_URL_CANONICAL}/registries/twix_config/objects/${object}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.ROLO_APIKEY_CONFIG}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`HTTP error, status: ${response.status}`);
  }
  const { record } = ZRecordWrapper.parse(await response.json());
  return record;
}
