import { Context } from "koa";
import { z } from "zod";
import { config } from "../config.js";

const ZKeyDef = z.object({
  key: z.string(),
  name: z.string(),
  kind: z.enum(["test", "live"]),
});

// validate the webhook header
export function validateLizhiWebhook(ctx: Context) {
  try {
    const apiKey = ctx.request.get("x-api-key");
    const keys = z.array(ZKeyDef).parse(JSON.parse(config.LIZHI_APIKEYS));
    const key = keys.find((key) => key.key === apiKey);
    if (!key) return null;
    return key;
  } catch (e) {
    console.log("Error validating Lizhi webhook", e);
    return null;
  }
}
