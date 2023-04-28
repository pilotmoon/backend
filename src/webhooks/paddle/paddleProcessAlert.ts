import { z } from "zod";
import { getRolo } from "../rolo.js";
import { log } from "../../logger.js";
import { ApiError } from "../../errors.js";

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
  log("info", "Paddle alert", { args, mode });
  const alertArgs = ZAlertArgs.parse(args);
  if (alertArgs.alert_name === "payment_refunded") {
    await processRefund(args, mode);
  } else {
    throw new ApiError(400, "Unknown alert_name: " + alertArgs.alert_name);
  }
}

async function processRefund(args: unknown, mode: "test" | "live") {
  const paddleArgs = ZRefundArgs.parse(args);
  const api = getRolo(mode);
  // find the order
  const { data } = await api.get("/licenseKeys/byOrder/" + paddleArgs.order_id);
  const response = ZRefundResponse.parse(data);
  // find orders that match origin "Paddle"
  const paddleOrders = response.items.filter((item) =>
    item.origin === "Paddle"
  );
  if (paddleOrders.length === 0) {
    throw new ApiError(400, "Paddle order not found");
  }
  if (paddleOrders.length > 1) {
    throw new ApiError(400, "Multiple Paddle orders found");
  }
  const order = paddleOrders[0];
  // set the void flag on license key
  const res = await api.patch("/licenseKeys/" + order.id, { void: true });
}
