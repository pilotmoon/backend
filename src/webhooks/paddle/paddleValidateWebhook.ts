import { ApiError } from "../../errors.js";
import { serialize } from "php-serialize";
import { createVerify } from "node:crypto";
import { z } from "zod";
import _ from "lodash";

const ZPaddleWebhookData = z.object({
  p_signature: z.string(),
}).passthrough();

// validate webhook signature (based on paddle docs)
export function validatePaddleWebhook(args: unknown, pubKey: string): void {
  const data = ZPaddleWebhookData.parse(args);
  // sort args by key and replace non-string values with stringified values
  const sorted = {} as any;
  for (const [key, val] of Object.entries(_.omit(data, "p_signature")).sort()) {
    if (typeof val === "string") {
      sorted[key] = val;
    } else {
      if (Array.isArray(val)) { // is it an array
        sorted[key] = val.toString();
      } else { //if its not an array and not a string, then it is a JSON obj
        sorted[key] = JSON.stringify(val);
      }
    }
  }
  // verify the serialized array against the signature using SHA1 with the public key
  const verifier = createVerify("sha1").update(serialize(sorted)).end();
  if (!verifier.verify(pubKey, Buffer.from(data.p_signature, "base64"))) {
    throw new ApiError(403, "Invalid signature");
  }
}