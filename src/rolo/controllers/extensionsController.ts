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
import { arrayFromQuery, boolFromQuery, stringFromQuery } from "../query.js";
import {
  ExtensionRecord,
  ZExtensionRecord,
  ZExtensionRecordWithData,
  processSubmission,
} from "./extensionsProcessor.js";

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
    collection.createIndex({ "info.published": 1 });
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

    return ZExtensionRecordWithData.parse(document);
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
      { returnDocument: "after" },
    );
    return !!result.value;
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

  /** SPECIAL AGGREGATION TO ADD firstCreated FIELD **/

  pipeline.push(
    { $sort: { created: -1 } },
    {
      $group: {
        _id: "$info.identifier",
        documents: { $push: "$$ROOT" },
        oldestCreated: { $last: "$created" },
      },
    },
    // Deconstruct the grouped documents back to a stream of documents
    { $unwind: "$documents" },
    // Re-add the firstCreated field to the documents
    {
      $addFields: {
        "documents.firstCreated": "$oldestCreated",
      },
    },
    // Use $replaceRoot to promote the documents fields back to the top level
    { $replaceRoot: { newRoot: "$documents" } },
  );

  /*** FLAGS */

  // published
  const published = boolFromQuery(query, "published", undefined);
  if (published !== undefined) {
    pipeline.push({ $match: { published } });
  }

  /*** ARRAYS TO SELECT SPECIFIC EXTENSIONS ***/

  // digest
  const digests = arrayFromQuery(query, "digest", []);
  if (digests.length > 0) {
    pipeline.push({ $match: { digest: { $in: digests } } });
  }

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

  // type
  const types = arrayFromQuery(query, "info.type", []);
  if (types.length > 0) {
    pipeline.push({ $match: { "info.type": { $in: types } } });
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

  return pipeline;
}
