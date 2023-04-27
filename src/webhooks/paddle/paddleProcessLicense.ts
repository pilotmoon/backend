import { z } from "zod";
import _ from "lodash";
import { getRolo } from "../rolo.js";
import { ZLicenseExternal } from "../../licenseFileObject.js";
import { log } from "../../logger.js";

const ZLicenseArgs = z.object({
  p_order_id: z.string(),
  p_quantity: z.string(),
  email: z.string(),
  name: z.string(),
  product: z.string(),
});

export async function processLicense(args: unknown, mode: "test" | "live") {
  // create license
  const paddleArgs = ZLicenseArgs.passthrough().parse(args);
  const api = getRolo(mode);
  const info = {
    email: paddleArgs.email,
    name: paddleArgs.name,
    product: paddleArgs.product,
    quantity: parseInt(paddleArgs.p_quantity),
    order: paddleArgs.p_order_id,
    origin: "Paddle",
    originData: _.omit(paddleArgs, "p_signature", "email", "name", "product"),
  };
  const { data } = await api.post("/licenseKeys", info);
  return ZLicenseExternal.parse(data);
}

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
    throw new Error("Unknown alert_name: " + alertArgs.alert_name);
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
    throw new Error("Paddle order not found");
  }
  if (paddleOrders.length > 1) {
    throw new Error("Multiple Paddle orders found");
  }
  const order = paddleOrders[0];
  // set the refunded flag on license key
  const res = await api.patch(
    "/licenseKeys/" + order.id,
    { void: true },
  );
  if (res.status !== 204) {
    throw new Error("Failed to update license key");
  }
}
