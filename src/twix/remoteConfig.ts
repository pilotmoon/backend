import { z } from "zod";
import { log, loge } from "../common/log.js";

export async function waitForRemoteConfigServer() {
  let retries = 0;
  let done = false;
  do {
    try {
      const response = await fetch(`${process.env.ROLO_URL_CANONICAL}/`, {
        method: "GET",
      });
      done = response.ok;
    } catch (e) {
      log(`Waiting for remote config server (${++retries})`.yellow);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } while (!done && retries < 60);
  if (done) {
    log("Remote config server is ready".black.bgGreen);
  } else {
    throw new Error("Remote config server timed out");
  }
}

export async function getRemoteConfig(object: string) {
  const response = await fetch(
    `${process.env.ROLO_URL_CANONICAL}/registries/twix_config/objects/${object}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.ROLO_APIKEY_CONFIG}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`HTTP error, status: ${response.status}`);
  }
  const { record } = z
    .object({
      object: z.literal("record"),
      record: z.record(z.unknown()),
    })
    .parse(await response.json());
  log(`Remote config ${object} loaded`.green);
  return record;
}
