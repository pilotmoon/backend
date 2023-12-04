import { Context } from "koa";
import { z } from "zod";
import { log } from "../../common/log.js";
import { getRemoteConfig } from "../remoteConfig.js";

const keys = z
  .object({
    keys: z.array(
      z.object({
        key: z.string(),
        name: z.string(),
        kind: z.enum(["test", "live"]),
      }),
    ),
  })
  .parse(await getRemoteConfig("user_apikeys")).keys;

// validate the webhook header
export function validateStoreWebhook(ctx: Context) {
  try {
    const apiKey = ctx.request.get("x-api-key");
    const key = keys.find((key) => key.key === apiKey);
    log("key", key);
    if (!key) return null;
    return key;
  } catch (e) {
    log("Error validating Store webhook", e);
    return null;
  }
}
