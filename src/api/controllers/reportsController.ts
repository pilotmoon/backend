// const collectionName = "licenseKeys";

import { ApiError } from "../../errors.js";
import { Auth, AuthKind } from "../auth.js";
import { getDb } from "../database.js";
import { collectionName as licenseKeysCollectionName } from "./licenseKeysController.js";

// helper function to get the database collection for a given key kind
function licenseKeysCollection(kind: AuthKind) {
  return getDb(kind).collection(licenseKeysCollectionName);
}

const reportGenerators: Record<
  string,
  (auth: Auth, gteDate: Date, getDate: Date) => object
> = {
  "summary": generateSummaryReport,
};

export async function generateReport(
  auth: Auth,
  gteDate: Date,
  ltDate: Date,
  name: string,
) {
  // check if report exists
  const generate = reportGenerators[name];
  if (!generate) throw new ApiError(404, `No such report '${name}'`);
  // check if user has access to report
  await auth.assertAccess("reports", name, "read");
  // generate report
  return await generate(auth, gteDate, ltDate);
}

async function generateSummaryReport(
  auth: Auth,
  gteDate: Date,
  ltDate: Date,
) {
  // aggregation pipeline
  const pipeline = [
    // filter by date range
    {
      $match: {
        "created": {
          $gte: gteDate,
          $lt: ltDate,
        },
      },
    },
    // facets
    {
      $facet: {
        // total number of license keys generated
        "total": [
          {
            $count: "count",
          },
        ],
        // number of license keys generated per product
        "products": [
          // group by product
          {
            $group: {
              "_id": "$product",
              "count": { $sum: 1 },
            },
          },
          // sort by count
          {
            $sort: {
              "count": -1,
            },
          },
        ],
        // number of license keys generated per origin
        "origins": [
          // group by origin
          {
            $group: {
              "_id": "$origin",
              "count": { $sum: 1 },
            },
          },
          // sort by count
          {
            $sort: {
              "count": -1,
            },
          },
        ],
        // number of license keys generated per coupon
        "coupons": [
          // filter by coupon
          {
            $match: {
              "originData.p_coupon": { $exists: true, "$ne": "" },
            },
          },
          // group by coupon
          {
            $group: {
              "_id": "$originData.p_coupon",
              "count": { $sum: 1 },
            },
          },
          // sort by count
          {
            $sort: {
              "count": -1,
            },
          },
        ],
      },
    },
    // convert total array to object
    {
      $set: {
        "total": {
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
        "total": "$total.count",
      },
    },
    // convert products array to object
    {
      $set: {
        "products": {
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
        "origins": {
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
        "coupons": {
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

  return {
    licenseKeys: await licenseKeysCollection(auth.kind)
      .aggregate(pipeline)
      .next(),
  };
}
