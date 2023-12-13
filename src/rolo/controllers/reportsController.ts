import { z } from "zod";
import { ApiError } from "../../common/errors.js";
import { Auth, type AuthKind } from "../auth.js";
import { getDb } from "../database.js";
import { collectionName as licenseKeysCollectionName } from "./licenseKeysController.js";
import { type Document } from "mongodb";

function licenseKeysCollection(kind: AuthKind) {
  return getDb(kind).collection(licenseKeysCollectionName);
}

const reportGenerators: Record<
  string,
  (auth: Auth, gteDate: Date, lt: Date) => Promise<Document>
> = {
  summary: generateSummaryReport,
  voidLicenseKeys: generateVoidHashesReport,
};

export async function generateReport(
  auth: Auth,
  gteDate: Date,
  ltDate: Date,
  name: string,
) {
  // check if user has access to report
  auth.assertAccess("reports", name, "read");
  // check if report exists
  const generate = reportGenerators[name];
  if (!generate) throw new ApiError(404, `No such report '${name}'`);
  // generate report
  return await generate(auth, gteDate, ltDate);
}

async function generateSummaryReport(auth: Auth, gteDate: Date, ltDate: Date) {
  // helper
  const facet = (keyPath: string) => [
    { $match: { [keyPath]: { $exists: true, $ne: "" } } },
    { $group: { _id: `$${keyPath}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { _id: 0, k: "$_id", v: "$count" } },
  ];

  // aggregation pipeline
  const pipeline = [
    { $match: { created: { $gte: gteDate, $lt: ltDate } } },
    {
      $facet: {
        total: [
          { $group: { _id: "all", count: { $sum: 1 } } },
          { $project: { _id: 0, k: "$_id", v: "$count" } },
        ],
        products: facet("product"),
        origins: facet("origin"),
        coupons: facet("originData.p_coupon"),
      },
    },
    { $set: { total: { $arrayToObject: "$total" } } },
    { $set: { products: { $arrayToObject: "$products" } } },
    { $set: { origins: { $arrayToObject: "$origins" } } },
    { $set: { coupons: { $arrayToObject: "$coupons" } } },
  ];

  // collect and return all results
  const licenseKeys = await licenseKeysCollection(auth.kind)
    .aggregate(pipeline)
    .next();
  return { licenseKeys };
}

// for each product, return the hashes of all license keys whose "void" field is true
// each license key has "hashes" field which is an array of strings.
async function generateVoidHashesReport(auth: Auth) {
  const pipeline = [
    { $match: { void: true } },
    { $project: { product: 1, hashes: 1 } },
    { $unwind: "$hashes" },
    { $group: { _id: "$product", hashes: { $addToSet: "$hashes" } } },
    { $group: { _id: null, data: { $push: { k: "$_id", v: "$hashes" } } } },
    { $replaceRoot: { newRoot: { $arrayToObject: "$data" } } },
  ];
  const report = z
    .record(z.array(z.string()))
    .parse(await licenseKeysCollection(auth.kind).aggregate(pipeline).next());
  for (const hashes of Object.values(report)) hashes.sort();
  return report;
}
