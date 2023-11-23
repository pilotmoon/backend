import { AxiosInstance } from "axios";
import { z } from "zod";
import { ApiError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import { getRolo } from "../rolo.js";

const ZAlertArgs = z.object({
  alert_name: z.string(),
});

export async function processAlert(args: unknown, mode: "test" | "live") {
  log("Processing alert:", args);
  const alertArgs = ZAlertArgs.parse(args);
  if (alertArgs.alert_name === "payment_refunded") {
    await processRefund(args, getRolo(mode));
  } else {
    throw new ApiError(400, `Unknown alert_name: ${alertArgs.alert_name}`);
  }
}

const ZRefundArgs = z.object({
  alert_name: z.literal("payment_refunded"),
  order_id: z.string(),
});

async function processRefund(args: unknown, api: AxiosInstance) {
  const paddleArgs = ZRefundArgs.parse(args);
  const id = await lookupOrder("Paddle", paddleArgs.order_id, api);
  await api.patch(`/licenseKeys/${id}`, { void: true });
}

const ZLookupResponse = z.object({
  object: z.literal("list"),
  items: z.array(
    z.object({
      id: z.string(),
      order: z.string().optional(),
      origin: z.string().optional(),
    }),
  ),
});

async function lookupOrder(origin: string, order: string, api: AxiosInstance) {
  const { data } = await api.get(`/licenseKeys/byOrder/${order}`);
  const response = ZLookupResponse.parse(data);
  const orders = response.items.filter((item) => item.origin === origin);
  if (orders.length !== 1) {
    throw new ApiError(400, `Found ${orders.length} orders`);
  }
  // return the license key id
  const result = orders[0].id;
  log(`Found ${result} for order ${order} and origin ${origin}`);
  return result;
}
