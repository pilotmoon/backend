import { z } from "zod";
import { ZBlobHash } from "../../common/blobSchemas.js";
import { handleControllerError } from "../../common/errors.js";
import { ZBlobFileList } from "../../common/fileList.js";
import { log } from "../../common/log.js";
import {
  NonNegativeSafeInteger,
  ZLocalizableString,
  ZSaneIdentifier,
  ZSaneLongString,
  ZSaneString,
} from "../../common/saneSchemas.js";
import { ZVersionString } from "../../common/versionString.js";
import { authKinds, type Auth, type AuthKind } from "../auth.js";
import { getDb } from "../database.js";
import { randomIdentifier } from "../identifiers.js";

export const submissionsCollectionName = "extensionSubmissions";
// helper function to get the database collection for a given key kind
function dbc(kind: AuthKind) {
  return getDb(kind).collection<ExtensionSubmissionRecord>(
    submissionsCollectionName,
  );
}

// called at server startup to create indexes
export async function init() {
  for (const kind of authKinds) {
    const collection = dbc(kind);
    collection.createIndex({ created: 1 });
  }
}

// identifies the origin of an extension
export const ZExtensionOrigin = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("githubRepo"),
    repoId: NonNegativeSafeInteger,
    repoName: ZSaneString,
    repoOwnerId: NonNegativeSafeInteger,
    repoOwnerName: ZSaneString,
    repoUrl: ZSaneString,
    repoTag: ZSaneString,
    nodePath: ZSaneString,
    nodeHash: ZBlobHash,
  }),
  z.object({
    type: z.literal("githubGist"),
  }),
]);
// schema for how extensions are submitted using POST /extensions
// (there is no PUT/PATCH -- only new full extension version submissions)
export const ZExtensionSubmission = z.object({
  origin: ZExtensionOrigin,
  version: ZVersionString,
  files: ZBlobFileList,
});
type ExtensionSubmission = z.infer<typeof ZExtensionSubmission>;

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

// schema for how extensions are stored in the database
export const ZExtensionSubmissionRecord = ZExtensionSubmission.extend({
  _id: z.string(),
  object: z.literal("extensionSubmission"),
  created: z.date(),
  result: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("accepted"),
      xid: z.string(),
      info: ZExtensionInfo,
    }),
    z.object({
      status: z.literal("rejected"),
      message: z.string(),
    }),
  ]),
});
type ExtensionSubmissionRecord = z.infer<typeof ZExtensionSubmissionRecord>;

// CRUD
export async function createExtensionSubmission(
  submission: ExtensionSubmission,
  auth: Auth,
) {
  auth.assertAccess(submissionsCollectionName, undefined, "create");
  log("Received extension submission");
  const document = ZExtensionSubmissionRecord.parse({
    _id: randomIdentifier("xs"),
    object: "extensionSubmission" as const,
    created: new Date(),
    ...submission,
    result: {
      status: "rejected",
      message: "Not yet implemented",
    },
  });

  try {
    await dbc(auth.kind).insertOne(document);
    return document;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

export async function readExtensionSubmission(id: string, auth: Auth) {
  auth.assertAccess(submissionsCollectionName, id, "read");
  const document = await dbc(auth.kind).findOne({ _id: id });
  if (!document) return null;

  try {
    return ZExtensionSubmissionRecord.parse(document);
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}