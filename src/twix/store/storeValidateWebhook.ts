import { Context } from "koa";
import { z } from "zod";
import { log } from "../../common/log.js";
import { getRemoteConfig } from "../remoteConfig.js";

const ZKeys = z.array(
  z.object({
    key: z.string(),
    name: z.string(),
    kind: z.enum(["test", "live"]),
  }),
);

let keys: z.infer<typeof ZKeys>;
export async function getKeys() {
  if (!keys) {
    keys = z
      .object({
        keys: ZKeys,
      })
      .parse(await getRemoteConfig("user_apikeys")).keys;
  }
  return keys;
}

// validate the webhook header
export async function validateStoreWebhook(ctx: Context) {
  try {
    const apiKey = ctx.request.get("x-api-key");
    const key = (await getKeys()).find((key) => key.key === apiKey);
    log("key", key);
    if (!key) return null;
    return key;
  } catch (e) {
    log("Error validating Store webhook", e);
    return null;
  }
}
