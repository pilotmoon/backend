import TTLCache from "@isaacs/ttlcache";
import { z } from "zod";
import { ApiError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import { minutes } from "../../common/timeIntervals.js";
import { getPaddleCheckoutApi } from "../paddle.js";
import { getPaddleCatalog } from "./catalog.js";

const cachedResponses = new TTLCache<string, PricesResult>({
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

const ZPricesResult = z.object({
  country: z.string(),
  prices: z.object({
    paddle: z.object({
      currency: z.string(),
      amount: z.number(),
      formatted: z.string(),
      netAmount: z.number(),
      netFormatted: z.string(),
    }),
  }),
});
export type PricesResult = z.infer<typeof ZPricesResult>;

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

export async function processPrices(
  ip: string,
  product: string,
): Promise<PricesResult> {
  // check cache
  const cached = cachedResponses.get(cacheKey(ip, product));
  if (cached) {
    log(`Using cached response for ${ip} ${product}`);
    return cached;
  }

  // get the single product id
  const productData = (await getPaddleCatalog())[product];
  if (!productData) {
    throw new ApiError(400, `Unknown product '${product}'`);
  }

  // look up with paddle
  const api = getPaddleCheckoutApi();
  const { data } = await api.get("2.0/prices", {
    params: { product_ids: productData.productId, customer_ip: ip },
  });
  const response = ZPricesResponse.parse(data);
  if (!response.success) {
    throw new ApiError(500, "Paddle API error (success=false)");
  }
  const productInfo = response.response.products[0];
  if (String(productInfo.product_id) !== productData.productId) {
    throw new ApiError(400, "Paddle API error (product not in response)");
  }
  const result = ZPricesResult.parse({
    country: response.response.customer_country,
    prices: {
      paddle: {
        currency: productInfo.currency,
        amount: productInfo.list_price.gross,
        formatted: formatCurrency(
          productInfo.list_price.gross,
          productInfo.currency,
        ),
        netAmount: productInfo.list_price.net,
        netFormatted: formatCurrency(
          productInfo.list_price.net,
          productInfo.currency,
        ),
      },
    },
  });
  cachedResponses.set(cacheKey(ip, product), result);
  return result;
}
