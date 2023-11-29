// const collectionName = "licenseKeys";

import { ApiError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import { Auth, AuthKind } from "../auth.js";
import { getDb } from "../database.js";
import { collectionName as licenseKeysCollectionName } from "./licenseKeysController.js";

// helper function to get the database collection for a given key kind
function licenseKeysCollection(kind: AuthKind) {
  return getDb(kind).collection(licenseKeysCollectionName);
}

const reportGenerators: Record<
  string,
  (
    auth: Auth,
    gteDate: Date,
    getDate: Date,
    query: Record<string, string>,
  ) => object
> = {
  summary: generateSummaryReport,
  licenseKeys: generateLicenseKeysReport,
  voidLicenseKeys: generateVoidLicenseKeysReport,
};

export async function generateReport(
  auth: Auth,
  gteDate: Date,
  ltDate: Date,
  name: string,
  query: Record<string, string>,
) {
  log("debug", "generateReport", { auth, gteDate, ltDate, name, query });
  // check if report exists
  const generate = reportGenerators[name];
  if (!generate) throw new ApiError(404, `No such report '${name}'`);
  // check if user has access to report
  await auth.assertAccess("reports", name, "read");
  // generate report
  return await generate(auth, gteDate, ltDate, query);
}

async function generateSummaryReport(
  auth: Auth,
  gteDate: Date,
  ltDate: Date,
  query: Record<string, string>,
) {
  // aggregation pipeline
  const pipeline = [
    // filter by date range
    {
      $match: {
        created: {
          $gte: gteDate,
          $lt: ltDate,
        },
      },
    },
    // facets
    {
      $facet: {
        // total number of license keys generated
        total: [
          {
            $count: "count",
          },
        ],
        // number of license keys generated per product
        products: [
          // filter by product
          {
            $match: {
              product: { $exists: true, $ne: "" },
            },
          },
          // group by product
          {
            $group: {
              _id: "$product",
              count: { $sum: 1 },
            },
          },
          // sort by count
          {
            $sort: {
              count: -1,
            },
          },
        ],
        // number of license keys generated per origin
        origins: [
          // filter by origin
          {
            $match: {
              origin: { $exists: true, $ne: "" },
            },
          },
          // group by origin
          {
            $group: {
              _id: "$origin",
              count: { $sum: 1 },
            },
          },
          // sort by count
          {
            $sort: {
              count: -1,
            },
          },
        ],
        // number of license keys generated per coupon
        coupons: [
          // filter by coupon
          {
            $match: {
              "originData.p_coupon": { $exists: true, $ne: "" },
            },
          },
          // group by coupon
          {
            $group: {
              _id: "$originData.p_coupon",
              count: { $sum: 1 },
            },
          },
          // sort by count
          {
            $sort: {
              count: -1,
            },
          },
        ],
      },
    },
    // convert total array to object
    {
      $set: {
        total: {
          $arrayToObject: {
            $map: {
              input: "$total",
              as: "total",
              in: {
                k: "count",
                v: "$$total.count",
              },
            },
          },
        },
      },
    },
    // convert total object to number
    {
      $set: {
        total: "$total.count",
      },
    },
    // convert products array to object
    {
      $set: {
        products: {
          $arrayToObject: {
            $map: {
              input: "$products",
              as: "product",
              in: {
                k: "$$product._id",
                v: "$$product.count",
              },
            },
          },
        },
      },
    },
    // convert origins array to object
    {
      $set: {
        origins: {
          $arrayToObject: {
            $map: {
              input: "$origins",
              as: "origin",
              in: {
                k: "$$origin._id",
                v: "$$origin.count",
              },
            },
          },
        },
      },
    },
    // convert coupons array to object
    {
      $set: {
        coupons: {
          $arrayToObject: {
            $map: {
              input: "$coupons",
              as: "coupon",
              in: {
                k: "$$coupon._id",
                v: "$$coupon.count",
              },
            },
          },
        },
      },
    },
  ];

  // collect and return all results
  const result = await licenseKeysCollection(auth.kind)
    .aggregate(pipeline)
    .toArray();
  return {
    licenseKeys: result[0],
  };
}

async function generateLicenseKeysReport(
  auth: Auth,
  gteDate: Date,
  ltDate: Date,
  query: Record<string, string>,
) {
  // get coupon prefix from query
  const couponPrefix = query.couponPrefix ?? "";

  // aggregation pipeline to get all purchases that used a coupon and return the details as an array
  const pipeline = [
    // filter by date range
    {
      $match: {
        created: {
          $gte: gteDate,
          $lt: ltDate,
        },
      },
    },
    // order by date then id
    {
      $sort: {
        date: 1,
        id: 1,
      },
    },
    // extract just the fields we are interested in:
    // date, id, product, origin, order, coupon, country, currency, sale gross, void
    {
      $project: {
        date: { $dateToString: { date: "$date" } },
        id: { $ifNull: ["$_id", ""] },
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
    },
    {
      $unset: ["_id"],
    },
    // match on coupon prefix
    {
      $match: {
        coupon: { $regex: `^${couponPrefix}` },
      },
    },
  ];

  return await licenseKeysCollection(auth.kind).aggregate(pipeline).toArray();
}

// for each product, return the hashes of all license keys whose "void" field is true
// each license key has "hashes" field which is an array of strings.
async function generateVoidLicenseKeysReport(
  auth: Auth,
  gteDate: Date,
  ltDate: Date,
  query: Record<string, string>,
) {
  const pipeline = [
    // match all void license keys (any dates)
    {
      $match: {
        void: true,
      },
    },
    // order by date then id
    {
      $sort: {
        date: 1,
        id: 1,
      },
    },

    // group by product
    {
      $group: {
        _id: "$product",
        hashes: {
          $push: "$hashes",
        },
      },
    },
    // combine all hashes into a single array
    {
      $set: {
        hashes: {
          $reduce: {
            input: "$hashes",
            initialValue: [],
            in: { $concatArrays: ["$$value", "$$this"] },
          },
        },
      },
    },
    // de-duplicate hashes
    {
      $set: {
        hashes: {
          $setUnion: "$hashes",
        },
      },
    },
  ];

  const result = await licenseKeysCollection(auth.kind)
    .aggregate(pipeline)
    .toArray();
  return result;
}
