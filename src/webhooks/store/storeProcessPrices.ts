import { z } from "zod";
import { ApiError } from "../../errors.js";
import { log } from "../../logger.js";
import { getPaddleCheckoutApi } from "../paddle.js";
import { paddleCatalog } from "./catalog.js";
import { minutes } from '../../timeIntervals.js'
import TTLCache from "@isaacs/ttlcache";

const cachedResponses = new TTLCache({
  max: 1000,
  ttl: minutes(15),
});

function cacheKey(ip: string, product: string) {
  return `${ip}+${product}`;
}

const ZPrice = z.object({
  gross: z.number(),
  net: z.number(),
  tax: z.number(),
});

const ZProduct = z.object({
  product_id: z.number(),
  product_title: z.string(),
  currency: z.string(),
  list_price: ZPrice,
});

const ZPricesResponse = z.object({
  success: z.boolean(),
  response: z.object({
    customer_country: z.string(),
    products: z.array(ZProduct),
  }),
});

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

export async function processPrices(ip: string, product: string) {
  // check cache
  const cached = cachedResponses.get(cacheKey(ip, product));
  if (cached){
    log(`Using cached response for ${ip} ${product}`);
    return cached;
  }

  // get the single product id
  const productData = paddleCatalog[product];
  if (productData?.productIds.length !== 1) {
    throw new ApiError(400, `Can't look up prices for '${product}'`);
  }
  const productId = productData.productIds[0];

  // look up with paddle
  const api = getPaddleCheckoutApi();
  const { data } = await api.get("2.0/prices", {
    params: { product_ids: productData.productIds[0] },
  });
  const response = ZPricesResponse.parse(data);
  if (!response.success) {
    throw new ApiError(500, "Paddle API error (success=false)");
  }
  const productInfo = response.response.products[0];
  if (String(productInfo.product_id) !== productId) {
    throw new ApiError(400, `Paddle API error (product not in response)`);
  }
  const result = {
    country: response.response.customer_country,
    prices: {
      paddle: {
        currency: productInfo.currency,
        amount: productInfo.list_price.gross,
        formatted: formatCurrency(productInfo.list_price.gross, productInfo.currency),
      },
    },
  };
  cachedResponses.set(cacheKey(ip, product), result);
  return result;
}
