import { serialize } from "php-serialize";
import { createVerify } from "node:crypto";
import { z } from "zod";
import { Context } from "koa";

const ZPaddleWebhookData = z
  .object({
    p_signature: z.string(),
  })
  .passthrough();
type PaddleWebhookData = z.infer<typeof ZPaddleWebhookData>;

// validate webhook signature (based on paddle docs)
export function validateWebhook(ctx: Context, pubKey: string): boolean {
  try {
    const data = ZPaddleWebhookData.parse(ctx.request.body);
    // sort args by key and replace non-string values with stringified values
    const sorted = {} as Record<string, unknown>;
    for (const [key, val] of Object.entries(data).sort()) {
      if (key === "p_signature") continue; // skip the signature
      if (typeof val === "string") {
        sorted[key] = val;
      } else if (Array.isArray(val)) {
        // is it an array
        sorted[key] = val.toString();
      } else {
        //if its not an array and not a string, then it is a JSON obj
        sorted[key] = JSON.stringify(val);
      }
    }
    // verify the serialized array against the signature using SHA1 with the public key
    const verifier = createVerify("sha1").update(serialize(sorted)).end();
    return verifier.verify(pubKey, Buffer.from(data.p_signature, "base64"));
  } catch (err) {
    return false;
  }
}
