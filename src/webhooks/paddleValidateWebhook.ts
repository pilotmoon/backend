import { ApiError } from "../errors.js";
import { serialize } from "php-serialize";
import { createVerify } from "node:crypto";

// public key from paddle dashboard
const pubKey = process.env.PADDLE_PUBKEY;
// validate webhook signature (based on paddle docs)
export function validatePaddleWebhook(args: any): void {
  if (typeof pubKey !== "string") {
    throw new ApiError(500, "No public key found");
  }
  if (typeof args.p_signature !== "string") {
    throw new ApiError(403, "No signature found");
  }
  // grab p_signature and remove it from the args
  const sig = Buffer.from(args.p_signature, "base64");
  delete args.p_signature;
  // sort args by key and replace non-string values with stringified values
  const sorted = {} as any;
  for (const [key, val] of Object.entries(args).sort()) {
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
  if (!verifier.verify(pubKey, sig)) {
    throw new ApiError(403, "Invalid signature");
  }
}
