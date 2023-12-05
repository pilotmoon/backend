import { z } from "zod";
import { getRemoteConfig } from "../remoteConfig.js";

const ZCatalogEntry = z.object({
  mode: z.enum(["live", "test"]),
  productId: z.string(),
});

const ZCouponOffer = z.object({
  product: z.string(),
  catalogEntry: ZCatalogEntry,
  discountPercent: z.number(),
  prefix: z.string().length(3),
});

let couponOffers: Record<string, z.infer<typeof ZCouponOffer> | undefined>;
export async function getCouponOffers() {
  if (!couponOffers) {
    const couponOffersRaw = z
      .record(ZCouponOffer.omit({ catalogEntry: true }))
      .parse(await getRemoteConfig("coupon_offers"));

    couponOffers = {};
    const paddleCatalog = await getPaddleCatalog();
    for (const [key, offer] of Object.entries(couponOffersRaw)) {
      if (offer) {
        const catalogEntry = paddleCatalog[offer.product];
        if (catalogEntry) {
          couponOffers[key] = {
            ...offer,
            catalogEntry,
          };
        }
      }
    }
  }

  return couponOffers;
}

let paddleCatalog: Record<string, z.infer<typeof ZCatalogEntry> | undefined>;
export async function getPaddleCatalog() {
  if (!paddleCatalog) {
    paddleCatalog = z
      .record(ZCatalogEntry)
      .parse(await getRemoteConfig("paddle_catalog"));
  }
  return paddleCatalog;
}
