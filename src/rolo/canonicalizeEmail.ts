import { sha256Hex } from "./sha256.js";

export function canonicalizeEmail(email: string) {
  // Trim, then split the email address into the local part and domain
  const [localPart, domain] = email.trim().toLowerCase().split("@");

  // Canonicalize the local part by removing dots
  // and removing any part after a plus sign
  const canonicalLocalPart = localPart.split(".").join("").split("+")[0];

  // Return the canonicalized email address
  return `${canonicalLocalPart}@${domain}`;
}

export function hashEmail(email: string) {
  return sha256Hex(canonicalizeEmail(email));
}
