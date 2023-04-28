import { z } from "zod";
import { getRolo } from "../rolo.js";
import { log } from "../../logger.js";
import { ApiError } from "../../errors.js";
import { AxiosInstance } from "axios";

const ZAlertArgs = z.object({
  alert_name: z.string(),
});
const ZRefundArgs = z.object({
  alert_name: z.literal("payment_refunded"),
  order_id: z.string(),
});
const ZRefundResponse = z.object({
  object: z.literal("list"),
  items: z.array(z.object({
    id: z.string(),
    order: z.string().optional(),
    origin: z.string().optional(),
  })),
});

export async function processAlert(args: unknown, mode: "test" | "live") {
  const alertArgs = ZAlertArgs.parse(args);
  if (alertArgs.alert_name === "payment_refunded") {
    await processRefund(args, getRolo(mode));
  } else {
    throw new ApiError(400, "Unknown alert_name: " + alertArgs.alert_name);
  }
}

async function processRefund(args: unknown, api: AxiosInstance) {
  const paddleArgs = ZRefundArgs.parse(args);
  const id = await getLicenseKeyId("Paddle", paddleArgs.order_id, api);
  await api.patch("/licenseKeys/" + id, { void: true });
}

// get the unique license key id for a given origin and order
async function getLicenseKeyId(
  origin: string,
  order: string,
  api: AxiosInstance,
) {
  const { data } = await api.get("/licenseKeys/byOrder/" + order);
  const response = ZRefundResponse.parse(data);
  const orders = response.items.filter((item) => item.origin === origin);
  if (orders.length !== 1) {
    throw new ApiError(400, `Found ${orders.length} orders`);
  }
  // return the license key id
  const result = orders[0].id;
  log(`Found ${result} for order ${order} and origin ${origin}`);
  return result;
}
