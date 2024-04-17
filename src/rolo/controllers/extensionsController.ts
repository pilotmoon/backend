import { z } from "zod";
import { ZBlobHash } from "../../common/blobSchemas.js";
import { handleControllerError } from "../../common/errors.js";
import { ZFileList } from "../../common/fileList.js";
import { log } from "../../common/log.js";
import {
  NonNegativeSafeInteger,
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
  fileList: ZFileList,
});
type ExtensionSubmission = z.infer<typeof ZExtensionSubmission>;

// schema for how extensions are stored in the database
export const ZExtensionSubmissionRecord = ZExtensionSubmission.extend({
  _id: z.string(),
  object: z.literal("extensionSubmission"),
  created: z.date(),
  result: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("accepted"),
      extensionId: z.string(),
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
  const document: ExtensionSubmissionRecord = {
    _id: randomIdentifier("xs"),
    object: "extensionSubmission" as const,
    created: new Date(),
    ...submission,
    result: {
      status: "rejected",
      message: "Not yet implemented",
    },
  };

  try {
    await dbc(auth.kind).insertOne(document);
    return document;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}
