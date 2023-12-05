import { z } from "zod";
import { log } from "../../common/log.js";

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
      .parse({
        popclip30: {
          product: "popclip",
          discountPercent: 30,
          prefix: "STU",
        },
        popclip44: {
          product: "popclip",
          discountPercent: 44,
          prefix: "STS",
        },
        example30: {
          product: "example",
          discountPercent: 30,
          prefix: "TST",
        },
      });

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

  log("couponOffers: ", couponOffers);
  return couponOffers;
}

let paddleCatalog: Record<string, z.infer<typeof ZCatalogEntry> | undefined>;
export async function getPaddleCatalog() {
  if (!paddleCatalog) {
    const paddleCatalogRaw = {
      popclip: {
        mode: "live",
        productIds: ["818494"],
      },
      example: {
        mode: "test",
        productIds: ["47023"],
      },
    };
    paddleCatalog = z.record(ZCatalogEntry).parse(paddleCatalogRaw);
  }
  return paddleCatalog;
}
