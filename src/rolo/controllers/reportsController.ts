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

// helper to convert array of { _id, count } into an object of key-value pairs
function setObject(key: string, subKey: string) {
  return {
    $set: {
      [key]: {
        $arrayToObject: {
          $map: {
            input: `$${key}`,
            in: { k: "$$this._id", v: `$$this.${subKey}` },
          },
        },
      },
    },
  };
}

async function generateSummaryReport(
  auth: Auth,
  gteDate: Date,
  ltDate: Date,
  query: Record<string, string>,
) {
  // aggregation pipeline
  const pipeline = [
    { $match: { created: { $gte: gteDate, $lt: ltDate } } },
    {
      $facet: {
        total: [{ $group: { _id: "all", count: { $sum: 1 } } }],
        products: [
          { $match: { product: { $exists: true, $ne: "" } } },
          { $group: { _id: "$product", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        origins: [
          { $match: { origin: { $exists: true, $ne: "" } } },
          { $group: { _id: "$origin", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        coupons: [
          { $match: { "originData.p_coupon": { $exists: true, $ne: "" } } },
          { $group: { _id: "$originData.p_coupon", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
      },
    },
    setObject("total", "count"),
    setObject("products", "count"),
    setObject("origins", "count"),
    setObject("coupons", "count"),
  ];

  // collect and return all results
  const licenseKeys = await licenseKeysCollection(auth.kind)
    .aggregate(pipeline)
    .next();
  return { licenseKeys };
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
    { $match: { created: { $gte: gteDate, $lt: ltDate } } },
    { $sort: { date: 1, _id: 1 } },
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
    { $unset: ["_id"] },
    { $match: { coupon: { $regex: `^${couponPrefix}` } } },
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
    { $match: { void: true } },
    { $project: { product: 1, hashes: 1 } },
    { $unwind: "$hashes" },
    { $group: { _id: "$product", hashes: { $addToSet: "$hashes" } } },
    { $sort: { _id: 1 } },
    { $group: { _id: null, data: { $push: { k: "$_id", v: "$hashes" } } } },
    { $replaceRoot: { newRoot: { $arrayToObject: "$data" } } },
  ];

  const result = await licenseKeysCollection(auth.kind)
    .aggregate(pipeline)
    .toArray();
  return result;
}
