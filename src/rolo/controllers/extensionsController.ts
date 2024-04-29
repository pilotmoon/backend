import type { Document } from "mongodb";
import { z } from "zod";
import { handleControllerError } from "../../common/errors.js";
import {
  ExtensionSubmission,
  ZExtensionSubmission,
  calculateDigest,
  canonicalSort,
} from "../../common/extensionSchemas.js";
import { log } from "../../common/log.js";
import {
  PositiveSafeInteger,
  ZSaneIdentifier,
  ZSaneLongString,
  ZSaneString,
} from "../../common/saneSchemas.js";
import { authKinds, type Auth, type AuthKind } from "../auth.js";
import { getDb } from "../database.js";
import { randomIdentifier } from "../identifiers.js";
import { Pagination, paginate } from "../paginate.js";
import { arrayFromQuery, stringFromQuery } from "../query.js";

export const extensionsCollectionName = "extensions";
// helper function to get the database collection for a given key kind
function dbc(kind: AuthKind) {
  return getDb(kind).collection<ExtensionRecord>(extensionsCollectionName);
}

// called at server startup to create indexes
export async function init() {
  for (const kind of authKinds) {
    const collection = dbc(kind);
    collection.createIndex({ created: 1 });
    collection.createIndex({ "info.identifier": 1 });
    collection.createIndex({ shortcode: 1 });
    collection.createIndex({ "origin.nodeSha": 1 }, { sparse: true });
    collection.createIndex({ "origin.commitSha": 1 }, { sparse: true });
    collection.createIndex({ digest: 1 }, { unique: true });
  }
}

export const ZExtensionAppInfo = z.object({
  name: ZSaneString,
  link: ZSaneString,
});

const ZIconComponents = z.object({
  prefix: ZSaneString,
  payload: ZSaneString,
  modifiers: z.record(z.unknown()),
});

export const ZExtensionInfo = z.object({
  name: ZSaneString,
  identifier: ZSaneIdentifier,
  description: ZSaneString.optional(),
  keywords: ZSaneString.optional(),
  icon: ZIconComponents.optional(),
  actionTypes: z.array(ZSaneString).optional(),
  entitlements: z.array(ZSaneString).optional(),
  apps: z.array(ZExtensionAppInfo).optional(),
  macosVersion: ZSaneString.optional(),
  popclipVersion: PositiveSafeInteger.optional(),
});

const ZExtensionCoreRecord = ZExtensionSubmission.extend({
  _id: z.string(),
  object: z.literal("extension"),
  created: z.date(),
});

const ZAcceptedExtensionRecord = ZExtensionCoreRecord.extend({
  shortcode: z.string(),
  info: ZExtensionInfo,
  published: z.boolean().optional(),
});

const ZRejectedExtensionRecord = ZExtensionCoreRecord.extend({
  message: ZSaneLongString,
});

export const ZExtensionRecord = z.discriminatedUnion("status", [
  ZAcceptedExtensionRecord.extend({ status: z.literal("accepted") }),
  ZRejectedExtensionRecord.extend({ status: z.literal("rejected") }),
]);
type ExtensionRecord = z.infer<typeof ZExtensionRecord>;

// CRUD
export async function createExtension(
  submission: ExtensionSubmission,
  auth: Auth,
) {
  auth.assertAccess(extensionsCollectionName, undefined, "create");
  log("Received extension submission");

  const document: ExtensionRecord = {
    _id: randomIdentifier("ext"),
    object: "extension",
    created: new Date(),
    ...submission,
    status: "rejected",
    message: "Not implemented",
  };

  try {
    await dbc(auth.kind).insertOne(ZExtensionRecord.parse(document));
    return document;
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

  return pipeline;
}
