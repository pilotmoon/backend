// const collectionName = "licenseKeys";

import { Auth, AuthKind } from "../auth.js";
import { getDb } from "../database.js";
import { LicenseKeyRecord } from "./licenseKeysController.js";
import { collectionName as licenseKeysCollectionName } from "../controllers/licenseKeysController.js";

// helper function to get the database collection for a given key kind
function licenseKeysCollection(kind: AuthKind) {
  return getDb(kind).collection<LicenseKeyRecord>(licenseKeysCollectionName);
}

export async function generateSummaryReport(
  auth: Auth,
  gteDate: Date,
  ltDate: Date,
) {
  auth.assertAccess("reports", undefined, "read");
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

  const licenseKeys = await licenseKeysCollection(auth.kind).aggregate(pipeline)
    .toArray();
  return { licenseKeys };
}
