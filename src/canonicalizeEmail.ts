export function canonicalizeEmail(email: string) {
  // Split the email address into the local part and domain
  const [localPart, domain] = email.toLowerCase().split("@");

  // Canonicalize the local part by removing dots
  // and removing any part after a plus sign
  const canonicalLocalPart = localPart
    .split(".")
    .join("")
    .split("+")[0];

  // Return the canonicalized email address
  return `${canonicalLocalPart}@${domain}`;
}
