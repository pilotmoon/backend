import { z } from "zod";
import { ZBlobHash } from "./blobSchemas.js";
import { ZBlobFileList } from "./fileList.js";
import {
  NonNegativeSafeInteger,
  ZSaneDate,
  ZSaneString,
} from "./saneSchemas.js";
import { ZVersionString } from "./versionString.js";
import { ZGitHubUserType } from "./githubTypes.js";

export const ZExtensionOriginGithubRepo = z.object({
  type: z.literal("githubRepo"),
  repoId: NonNegativeSafeInteger,
  repoName: ZSaneString,
  repoOwnerId: NonNegativeSafeInteger,
  repoOwnerHandle: ZSaneString,
  repoOwnerType: ZGitHubUserType,
  repoUrl: ZSaneString,
  commitSha: ZBlobHash,
  commitDate: ZSaneDate,
  nodePath: z.string(),
  nodeSha: ZBlobHash,
  nodeType: z.enum(["blob", "tree"]),
});
export type ExtensionOriginGithubRepo = z.infer<
  typeof ZExtensionOriginGithubRepo
>;

export const ZExtensionOriginGithubGist = z.object({
  type: z.literal("githubGist"),
  gistId: ZSaneString,
  gistOwnerId: NonNegativeSafeInteger,
  gistOwnerHandle: ZSaneString,
  gistOwnerType: ZGitHubUserType,
  gistUrl: ZSaneString,
  commitSha: ZBlobHash,
  commitDate: ZSaneDate,
});

export const ZExtensionOrigin = z.discriminatedUnion("type", [
  ZExtensionOriginGithubRepo,
  ZExtensionOriginGithubGist,
]);
export type ExtensionOrigin = z.infer<typeof ZExtensionOrigin>;

export const ZExtensionSubmission = z.object({
  version: ZVersionString,
  origin: ZExtensionOrigin,
  files: ZBlobFileList,
});
export type ExtensionSubmission = z.infer<typeof ZExtensionSubmission>;
