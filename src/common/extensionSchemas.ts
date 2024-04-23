import { z } from "zod";
import { ZBlobHash } from "./blobSchemas.js";
import { ZBlobFileList } from "./fileList.js";
import { NonNegativeSafeInteger, ZSaneString } from "./saneSchemas.js";
import { ZVersionString } from "./versionString.js";

export const ZExtensionOrigin = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("unknown"),
  }),
  z.object({
    type: z.literal("githubRepo"),
    repoId: NonNegativeSafeInteger,
    repoName: ZSaneString,
    repoOwnerId: NonNegativeSafeInteger,
    repoOwnerHandle: ZSaneString,
    repoOwnerType: z.enum(["User", "Organization"]),
    repoUrl: ZSaneString,
    commitSha: ZBlobHash,
    nodePath: z.string(),
    nodeSha: ZBlobHash,
    nodeType: z.enum(["blob", "tree"]),
  }),
]);
export type ExtensionOrigin = z.infer<typeof ZExtensionOrigin>;

export const ZExtensionSubmission = z.object({
  version: ZVersionString,
  origin: ZExtensionOrigin,
  files: ZBlobFileList,
});
export type ExtensionSubmission = z.infer<typeof ZExtensionSubmission>;
