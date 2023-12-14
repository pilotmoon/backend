import { type Document } from "mongodb";
import { z } from "zod";
import { log } from "../../common/log.js";
import { ZSaneAlphanum, ZSaneString } from "../../common/saneSchemas.js";
import { hashEmail } from "../canonicalizeEmail.js";

function assignMatch(
  doc: Document,
  docKey: string,
  query: Record<string, unknown>,
  queryKey: string,
  transform?: (val: string) => Document | string | boolean | undefined,
) {
  const val = query[queryKey];
  if (typeof val === "string") {
    doc[docKey] = transform ? transform(val) : val;
  }
}

function matchFlagQuery(val: string) {
  if (val === "") {
    return true;
  }
  if (val === "no") {
    return { $ne: true };
  }
}

export function getQueryPipeline(query: unknown) {
  const pipeline: Document[] = [];
  log("getQueryPipeline", { query });
  enum View {
    Default = "default",
    Financial = "financial",
    Redacted = "redacted",
  }

  const ZBoolQuery = z.enum(["", "no"]);

  const q = z
    .object({
      email: z.string().optional(),
      origin: ZSaneString.optional(),
      order: ZSaneString.optional(),
      void: ZBoolQuery.optional(),
      refunded: ZBoolQuery.optional(),
      couponPrefix: ZSaneAlphanum.optional(),
      view: z.nativeEnum(View).optional(),
    })
    .parse(query);

  // match on query
  const $match: Document = {};
  assignMatch($match, "emailHash", q, "email", hashEmail);
  assignMatch($match, "origin", q, "origin");
  assignMatch($match, "order", q, "order");
  assignMatch($match, "void", q, "void", matchFlagQuery);
  assignMatch($match, "refunded", q, "refunded", matchFlagQuery);
  assignMatch($match, "originData.p_coupon", q, "couponPrefix", (val) => {
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
    default:
  }

  return pipeline;
}
