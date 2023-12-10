import { z } from "zod";
import { log } from "../common/log.js";

export const remoteConfigReady = async () =>
  (await fetch(`${process.env.ROLO_URL_CANONICAL}/`)).ok;

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
