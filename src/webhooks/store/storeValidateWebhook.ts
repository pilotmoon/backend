import { Context } from "koa";
import { z } from "zod";
import { config } from "../config.js";

const ZKeyDef = z.object({
  key: z.string(),
  name: z.string(),
  kind: z.enum(["test", "live"]),
});

const keys = z.array(ZKeyDef).parse(JSON.parse(config.TWIX_APIKEYS));

// validate the webhook header
export function validateStoreWebhook(ctx: Context) {
  try {
    const apiKey = ctx.request.get("x-api-key");
    const key = keys.find((key) => key.key === apiKey);
    console.log("key", key);
    if (!key) return null;
    return key;
  } catch (e) {
    console.log("Error validating Lizhi webhook", e);
    return null;
  }
}
