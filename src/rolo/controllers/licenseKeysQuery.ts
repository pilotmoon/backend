import { type Document } from "mongodb";
import { z } from "zod";
import { log } from "../../common/log.js";
import { ZSaneAlphanum, ZSaneString } from "../../common/saneSchemas.js";
import { hashEmail } from "../canonicalizeEmail.js";
import {
  ZBoolQueryValue,
  assignMatch,
  matchExpressionFromQueryValue,
} from "../query.js";

export function getQueryPipeline(query: unknown) {
  const pipeline: Document[] = [];
  log("getQueryPipeline", { query });
  enum View {
    Default = "default",
    Financial = "financial",
    Redacted = "redacted",
    Hashes = "hashes",
  }

  const q = z
    .object({
      email: z.string().optional(),
      product: ZSaneString.optional(),
      origin: ZSaneString.optional(),
      order: ZSaneString.optional(),
      void: ZBoolQueryValue.optional(),
      refunded: ZBoolQueryValue.optional(),
      couponPrefix: ZSaneAlphanum.optional(),
      view: z.nativeEnum(View).optional(),
    })
    .parse(query);

  // match on query
  const $match: Document = {};
  assignMatch($match, "emailHash", q.email, hashEmail);
  assignMatch($match, "product", q.product);
  assignMatch($match, "origin", q.origin);
  assignMatch($match, "order", q.order);
  assignMatch($match, "void", q.void, matchExpressionFromQueryValue);
  assignMatch($match, "refunded", q.refunded, matchExpressionFromQueryValue);
  assignMatch($match, "originData.p_coupon", q.couponPrefix, (val) => {
    return { $regex: `^${val}` };
  });
  pipeline.push({ $match });

  switch (q.view) {
    case View.Financial:
      pipeline.push({
        $project: {
          object: "licenseKeyFinancialView",
          created: 1,
          product: { $ifNull: ["$product", ""] },
          origin: { $ifNull: ["$origin", ""] },
          order: { $ifNull: ["$order", ""] },
          coupon: { $ifNull: ["$originData.p_coupon", ""] },
          country: { $ifNull: ["$originData.p_country", ""] },
          currency: { $ifNull: ["$originData.p_currency", ""] },
          saleGross: {
            $cond: {
              if: "$refunded",
              then: "0.00",
              else: { $ifNull: ["$originData.p_sale_gross", ""] },
            },
          },
          status: { $cond: { if: "$refunded", then: "refunded", else: "" } },
        },
      });
      break;
    case View.Redacted:
      pipeline.push({
        $unset: ["email", "name"],
      });
      break;
    case View.Hashes:
      pipeline.push({
        $unwind: "$hashes",
      });
      pipeline.push({
        $project: {
          object: "licenseKeyHashesView",
          created: 1,
          product: 1,
          origin: 1,
          hashes: 1,
          void: 1,
          refunded: 1,
        },
      });
      break;
    default:
  }

  return pipeline;
}
