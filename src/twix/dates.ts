import { log } from "console";

export function dates(args: { valid_months?: number }) {
  const date = new Date();
  let expiryDate;
  if (args.valid_months) {
    expiryDate = new Date(date);
    expiryDate.setMonth(expiryDate.getMonth() + args.valid_months);
  }
  log("dates:", { date, expiryDate });
  return { date, expiryDate };
}
