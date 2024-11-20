import { ApiError } from "../../common/errors.js";
import { config } from "../config.js";
import { processCoupon } from "./storeProcessCoupon.js";
import { processLicense } from "./storeProcessLicense.js";
import { getProducts } from "./storeGetProducts.js";
import { validateStoreWebhook } from "./storeValidateWebhook.js";
import { makeRouter } from "../koaWrapper.js";
import { stringFromQuery } from "../../common/query.js";
import { getLicense } from "./storeGetLicense.js";
import { z } from "zod";

export const router = makeRouter();

router.post("/webhooks/store/generateLicense", async (ctx) => {
  const key = await validateStoreWebhook(ctx);
  if (!key) {
    throw new ApiError(401, "Missing or invalid API key");
  }
  const license = await processLicense(ctx.request.body, key.name, key.kind);
  ctx.body = {
    web_url: config.ROLO_URL_CANONICAL + license.file.url,
    license_id: license.id,
    file_name: license.file.name,
    file_data: license.file.data,
  };
  ctx.status = 201;
});

router.post("/webhooks/store/generateCoupon", async (ctx) => {
  const key = await validateStoreWebhook(ctx);
  if (!key) {
    throw new ApiError(401, "Missing or invalid API key");
  }
  ctx.body = await processCoupon(
    ctx.alog,
    ctx.request.body,
    key.name,
    key.kind,
  );
  ctx.status = 201;
});

router.get("/frontend/store/getProducts", async (ctx) => {
  const sourceIp = ctx.request.ip;
  const products = stringFromQuery(ctx.query, "products", "");
  const coupons = stringFromQuery(ctx.query, "coupons", "");
  ctx.alog.log(
    `getProducts request received from IP: ${sourceIp}, coupons: ${coupons}`,
  );
  let result = await getProducts(sourceIp, products, coupons);
  ctx.alog.log({ result });
  ctx.set("Cache-Control", "private, max-age=900");
  ctx.body = result;
});

// get license info for given flow id
router.get("/frontend/store/getLicense", async (ctx) => {
  const sourceIp = ctx.request.ip;
  const parsedQuery = z
    .object({
      flowId: z.string().min(24),
      mode: z.enum(["live", "test"]),
    })
    .parse({
      flowId: stringFromQuery(ctx.query, "flowId", ""),
      mode: stringFromQuery(ctx.query, "mode", "live"),
    });
  ctx.alog.log(
    `getLicense request received from IP: ${sourceIp}, flowId: ${parsedQuery.flowId}`,
  );
  let result = await getLicense(parsedQuery.flowId, parsedQuery.mode);
  ctx.alog.log({ result });
  ctx.set("Cache-Control", "private");
  ctx.body = result;
});
