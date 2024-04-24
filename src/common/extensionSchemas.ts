import { z } from "zod";
import { ZBlobHash } from "./blobSchemas.js";
import { ZBlobFileList } from "./fileList.js";
import {
  NonNegativeSafeInteger,
  ZSaneDate,
  ZSaneString,
} from "./saneSchemas.js";
import { ZVersionString } from "./versionString.js";

export const ZExtensionOriginGithub = z.object({
  type: z.literal("githubRepo"),
  repoId: NonNegativeSafeInteger,
  repoName: ZSaneString,
  repoOwnerId: NonNegativeSafeInteger,
  repoOwnerHandle: ZSaneString,
  repoOwnerType: z.enum(["User", "Organization"]),
  repoUrl: ZSaneString,
  commitSha: ZBlobHash,
  commitDate: ZSaneDate,
  nodePath: z.string(),
  nodeSha: ZBlobHash,
  nodeType: z.enum(["blob", "tree"]),
});
export type ExtensionOriginGithub = z.infer<typeof ZExtensionOriginGithub>;

export const ZPartialExtensionOriginGithub = ZExtensionOriginGithub.omit({
  nodePath: true,
  nodeSha: true,
  nodeType: true,
});
export type PartialExtensionOriginGithub = z.infer<
  typeof ZPartialExtensionOriginGithub
>;

export const ZExtensionOrigin = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("unknown"),
  }),
  ZExtensionOriginGithub,
]);
export type ExtensionOrigin = z.infer<typeof ZExtensionOrigin>;

export const ZExtensionSubmission = z.object({
  version: ZVersionString,
  origin: ZExtensionOrigin,
  files: ZBlobFileList,
});
export type ExtensionSubmission = z.infer<typeof ZExtensionSubmission>;
