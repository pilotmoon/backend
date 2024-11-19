import { z } from "zod";
import { ApiError } from "../../common/errors.js";
import { getPaddleCheckoutApi } from "../paddle.js";
import { CatalogEntry, getPaddleCatalog } from "./catalog.js";

const ZPaddlePrice = z.object({
  gross: z.number(),
  net: z.number(),
  tax: z.number(),
});

const ZPaddleCoupon = z.object({
  code: z.string(),
  discount: z.number(),
});

const ZPaddleProduct = z.object({
  product_id: z.number(),
  product_title: z.string(),
  currency: z.string(),
  vendor_set_prices_included_tax: z.boolean(),
  price: ZPaddlePrice,
  list_price: ZPaddlePrice,
  applied_coupon: z.union([
    z.array(z.unknown()).length(0).length(0),
    ZPaddleCoupon,
  ]),
});

const ZPaddlePricesResponse = z.object({
  success: z.literal(true),
  response: z.object({
    customer_country: z.string(),
    products: z.array(ZPaddleProduct),
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
  const parsedResponse = ZPaddlePricesResponse.safeParse(data);
  if (!parsedResponse.success) {
    throw new ApiError(500, "Paddle API error");
  }
  const productInfo = parsedResponse.data.response.products[0];
  if (String(productInfo.product_id) !== productData.productId) {
    throw new ApiError(400, "Paddle API error (product not in response)");
  }
  const result = ZPricesResult.parse({
    country: parsedResponse.data.response.customer_country,
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
  return result;
}

const ZProductOffering = z.object({
  vendor: z.literal("paddle"),
  product: z.string(), // e.g. "popclip"
  paddleData: ZPaddleProduct,
});
type ProductOffering = z.infer<typeof ZProductOffering>;

const ZProductsResult = z.object({
  countryCode: z.string(),
  products: z.record(z.string(), ZProductOffering),
});
export type ProductsResult = z.infer<typeof ZProductsResult>;

export async function getProducts(
  ip: string,
  products: string,
  coupons: string,
) {
  // map product id string to catalog entry
  const productData: Record<string, CatalogEntry> = {};
  for (let product of products.split(",")) {
    let entry = (await getPaddleCatalog())[product];
    if (!entry) {
      throw new ApiError(400, `Unknown product '${product}'`);
    }
    productData[product] = entry;
  }

  // look up with paddle
  const api = getPaddleCheckoutApi();
  const { data } = await api.get("2.0/prices", {
    params: {
      product_ids: Object.values(productData)
        .map((d) => d.productId)
        .join(","),
      customer_ip: ip,
      coupons: coupons,
    },
  });
  const response = ZPaddlePricesResponse.parse(data);
  if (!response.success) {
    throw new ApiError(500, "Paddle API error (success=false)");
  }

  let productsRecord: Record<string, ProductOffering> = {};
  for (let [product, entry] of Object.entries(productData)) {
    const productInfo = response.response.products.find(
      (p) => p.product_id === Number(entry.productId),
    );
    if (!productInfo) {
      throw new ApiError(500, "Paddle API error (product not found)");
    }
    productsRecord[product] = {
      vendor: "paddle",
      product,
      paddleData: productInfo,
    };
  }

  return ZProductsResult.parse({
    countryCode: response.response.customer_country,
    products: productsRecord,
  });
}
