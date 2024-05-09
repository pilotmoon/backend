import type { Document } from "mongodb";
import { handleControllerError } from "../../common/errors.js";
import {
  ExtensionPatch,
  ExtensionSubmission,
} from "../../common/extensionSchemas.js";
import { log } from "../../common/log.js";
import { authKinds, type Auth, type AuthKind } from "../auth.js";
import { getClient, getDb } from "../database.js";
import { Pagination, paginate } from "../paginate.js";
import {
  arrayFromQuery,
  boolFromQuery,
  stringFromQuery,
} from "../../common/query.js";
import {
  ExtensionRecord,
  ZExtensionRecord,
  processSubmission,
} from "./extensionsProcessor.js";
import { createEventInternal } from "./eventsController.js";
import { extractDefaultString } from "../../common/saneSchemas.js";
import { StatusChangeEvent, reviewStatus } from "../../common/events.js";

export const extensionsCollectionName = "extensions";
// helper function to get the database collection for a given key kind
function dbc(kind: AuthKind) {
  return getDb(kind).collection<ExtensionRecord>(extensionsCollectionName, {
    ignoreUndefined: true,
  });
}

// called at server startup to create indexes
export async function init() {
  for (const kind of authKinds) {
    const collection = dbc(kind);
    collection.createIndex({ created: -1 });
    collection.createIndex({ shortcode: 1, version: 1 }, { unique: true });
    collection.createIndex(
      { "info.identifier": 1, version: 1 },
      { unique: true },
    );
    collection.createIndex({ "info.type": 1 });
    collection.createIndex({ published: 1 });
    collection.createIndex({ "origin.nodeSha": 1 }, { sparse: true });
    collection.createIndex({ "origin.commitSha": 1 }, { sparse: true });
  }
}

// CRUD
export async function createExtension(
  submission: ExtensionSubmission,
  auth: Auth,
) {
  auth.assertAccess(extensionsCollectionName, undefined, "create");
  const session = getClient().startSession();

  try {
    let document: ExtensionRecord | null = null;
    await session.withTransaction(async () => {
      document = ZExtensionRecord.parse(
        await processSubmission(submission, dbc(auth.kind), auth),
      );
      log("inserting", document);
      await dbc(auth.kind).insertOne(document);
    });
    if (!document) {
      throw new Error("Failed to process extension submission");
    }
    return document as ExtensionRecord;
  } catch (error) {
    handleControllerError(error);
    throw error;
  } finally {
    session.endSession();
  }
}

export async function readExtensionWithData(
  id: string,
  auth: Auth,
  excludeRegex?: RegExp,
) {
  auth.assertAccess(extensionsCollectionName, id, "read");
  excludeRegex = excludeRegex || /^$/;
  try {
    // for each file in files array, look up the data from the blob store and add it in to that entry
    const pipeline = [
      { $match: { _id: id } },
      // unwind the files array so that we can look up each file
      { $unwind: "$files" },
      // filter out files that match the exclude regex
      { $match: { "files.path": { $not: { $regex: excludeRegex } } } },
      // look up the file in the blob store
      {
        $lookup: {
          from: "blobs",
          localField: "files.hash",
          foreignField: "h2",
          as: "files.blob",
        },
      },
      // unwind the blob array so that we can merge the blob data into the file data
      { $unwind: "$files.blob" },
      // merge the blob data into the file data
      { $addFields: { "files.data": "$files.blob.data" } },
      // group the files back into an array
      {
        $group: {
          _id: "$_id",
          files: { $push: "$files" },
          data: { $first: "$$ROOT" },
        },
      },
      // replace the files array with the new files array
      {
        $replaceRoot: {
          newRoot: { $mergeObjects: ["$data", { files: "$files" }] },
        },
      },
      // project out the blob data
      {
        $project: { "files.blob": 0 },
      },
    ];
    const document = await dbc(auth.kind).aggregate(pipeline).next();
    if (!document) return null;
    // replace the Binary with Buffer object
    document.files = document.files.map((file: any) => ({
      ...file,
      data: Buffer.from(file.data.buffer),
    }));

    return ZExtensionRecord.parse(document);
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

export async function readExtension(id: string, auth: Auth) {
  auth.assertAccess(extensionsCollectionName, id, "read");
  try {
    const document = await dbc(auth.kind).findOne({ _id: id });
    if (!document) return null;
    return ZExtensionRecord.parse(document);
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

export async function updateExtension(
  id: string,
  patch: ExtensionPatch,
  auth: Auth,
) {
  auth.assertAccess(extensionsCollectionName, id, "update");
  try {
    const result = await dbc(auth.kind).findOneAndUpdate(
      { _id: id },
      { $set: patch },
      { returnDocument: "before" },
    );
    if (!result.value) return false;
    // see if published or reviewed status changed
    let oldStatus = reviewStatus(result.value);
    let newStatus = reviewStatus(patch);
    if (oldStatus !== newStatus) {
      const event: StatusChangeEvent = {
        type: "statusChange",
        timestamp: new Date(),
        logUrl: null,
        submission: {
          status: "ok",
          origin: result.value.origin,
          id: result.value._id,
          shortcode: result.value.shortcode,
          version: result.value.version,
          info: result.value.info,
          reviewStatus: newStatus,
          reviewComments: patch.reviewComments ?? null,
        },
      };
      createEventInternal(event, auth.kind);
    }
    return true;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

export async function listExtensions(
  query: unknown,
  pagination: Pagination,
  auth: Auth,
) {
  auth.assertAccess(extensionsCollectionName, undefined, "list");
  try {
    const documents = await paginate(
      dbc(auth.kind),
      pagination,
      getQueryPipeline(query),
    );
    return documents;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

export function getQueryPipeline(query: unknown) {
  const pipeline: Document[] = [];
  log("getQueryPipeline", { query });

  /*** FILTER STRINGS THAT DON'T RESRICT VERSIONS ***/

  // identifier
  const identifier = stringFromQuery(query, "info.identifier", "");
  if (identifier) {
    pipeline.push({ $match: { "info.identifier": identifier } });
  }

  // shortcode
  const shortcode = stringFromQuery(query, "shortcode", "");
  if (shortcode) {
    pipeline.push({ $match: { shortcode } });
  }

  // type
  const types = arrayFromQuery(query, "info.type", []);
  if (types.length > 0) {
    pipeline.push({ $match: { "info.type": { $in: types } } });
  }

  /*** FLAGS */

  // published
  const published = boolFromQuery(query, "published", undefined);
  if (published !== undefined) {
    pipeline.push({ $match: { published } });
  }

  /** SPECIAL AGGREGATION TO GET LATEST VERSION ONLY, ADD PREVIOUS VERSION INFO
  TO EACH DOCUMENT, AND CALCULATE firstCreated **/
  if (boolFromQuery(query, "flatten", false)) {
    pipeline.push(
      // was: { $sort: { created: -1 } },
      {
        $addFields: {
          versionArray: {
            $map: {
              input: { $split: ["$version", "."] },
              as: "digit",
              in: { $toInt: "$$digit" },
            },
          },
        },
      },
      {
        $sort: {
          "versionArray.0": -1,
          "versionArray.1": -1,
          "versionArray.2": -1,
          "versionArray.3": -1,
        },
      },
      { $unset: "versionArray" },
      // Group by identifer and push all documents into an array
      {
        $group: {
          _id: "$info.identifier",
          latest: { $first: "$$ROOT" },
          firstCreated: { $last: "$created" },
          previousVersions: {
            $topN: {
              n: 30,
              sortBy: { created: -1 },
              output: { $unsetField: { field: "files", input: "$$ROOT" } },
            },
          },
        },
      },
      // Add the firstCreated and previousVersions field to each document
      {
        $addFields: {
          "latest.firstCreated": "$firstCreated",
          "latest.previousVersions": {
            $filter: {
              input: "$previousVersions",
              as: "version",
              cond: {
                $ne: ["$$version.version", "$latest.version"],
              },
            },
          },
        },
      },
      // Use $replaceRoot to promote the documents fields back to the top level
      { $replaceRoot: { newRoot: "$latest" } },
    );
  } else {
    // not flattening
    /*** ARRAYS TO SELECT SPECIFIC EXTENSIONS ***/

    // commitSha
    const commitShas = arrayFromQuery(query, "origin.commitSha", []);
    if (commitShas.length > 0) {
      pipeline.push({ $match: { "origin.commitSha": { $in: commitShas } } });
    }

    // nodeSha
    const nodeShas = arrayFromQuery(query, "origin.nodeSha", []);
    if (nodeShas.length > 0) {
      pipeline.push({ $match: { "origin.nodeSha": { $in: nodeShas } } });
    }

    /*** SPECIAL: VERSION ***/

    // version
    const version = stringFromQuery(query, "version", "");
    if (version) {
      if (version === "latest") {
        pipeline.push({ $sort: { created: -1 } });
        pipeline.push({
          $group: { _id: "$info.identifier", newestDoc: { $first: "$$ROOT" } },
        });
        pipeline.push({ $replaceRoot: { newRoot: "$newestDoc" } });
      } else {
        pipeline.push({ $match: { version } });
      }
    }

    /*** SPECIAL: EXTRACT / PROJECT ***/

    // project one field only
    const extract = stringFromQuery(query, "extract", "");
    if (extract) {
      pipeline.push({ $project: { object: 1, created: 1, [`${extract}`]: 1 } });
    }

    // project multiple fields
    const project = arrayFromQuery(query, "project", []);
    if (project.length > 0) {
      const projection: Document = { object: 1, created: 1 };
      project.forEach((field) => {
        projection[field] = 1;
      });
      pipeline.push({ $project: projection });
    }
  }

  return pipeline;
}
