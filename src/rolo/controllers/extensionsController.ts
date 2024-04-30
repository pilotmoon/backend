import type { Document } from "mongodb";
import { handleControllerError } from "../../common/errors.js";
import { ExtensionSubmission } from "../../common/extensionSchemas.js";
import { log } from "../../common/log.js";
import { authKinds, type Auth, type AuthKind } from "../auth.js";
import { getClient, getDb } from "../database.js";
import { Pagination, paginate } from "../paginate.js";
import { arrayFromQuery, stringFromQuery } from "../query.js";
import {
  ExtensionRecord,
  ZExtensionRecord,
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
    collection.createIndex({ filesDigest: 1 }, { unique: true });
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
      // do replaceOne upsert on filesDigest key
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

export async function listExtensions(
  query: unknown,
  pagination: Pagination,
  auth: Auth,
) {
  auth.assertAccess(extensionsCollectionName, undefined, "read");
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

  // extract?
  const extract = stringFromQuery(query, "extract", "");
  if (extract) {
    pipeline.push({ $project: { object: 1, created: 1, [`${extract}`]: 1 } });
  }

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

  // version
  const version = stringFromQuery(query, "version", "");
  if (version) {
    pipeline.push({ $match: { version } });
  }

  return pipeline;
}
