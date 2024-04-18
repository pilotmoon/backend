import { z } from "zod";
import { handleControllerError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import {
  ZSaneIdentifier,
  ZSaneLongString,
  ZSaneString,
} from "../../common/saneSchemas.js";
import { authKinds, type Auth, type AuthKind } from "../auth.js";
import { getDb } from "../database.js";
import { randomIdentifier } from "../identifiers.js";
import {
  ExtensionSubmission,
  ZExtensionSubmission,
} from "../../common/extensionSchemas.js";

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
  identifier: ZSaneIdentifier.optional(),
  description: ZSaneString.optional(),
  keywords: ZSaneString.optional(),
  icon: ZIconComponents.optional(),
  actionTypes: z.array(ZSaneString).optional(),
  entitlements: z.array(ZSaneString).optional(),
  apps: z.array(ZExtensionAppInfo).optional(),
});

const ZExtensionCoreRecord = ZExtensionSubmission.extend({
  _id: z.string(),
  object: z.literal("extension"),
  created: z.date(),
});

const ZAcceptedExtensionRecord = ZExtensionCoreRecord.extend({
  xid: z.string(),
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
export async function createExtensionSubmission(
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

export async function readExtensionSubmission(id: string, auth: Auth) {
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
