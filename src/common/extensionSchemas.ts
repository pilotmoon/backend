import { z } from "zod";
import { ZBlobHash } from "./blobSchemas.js";
import { BlobFileList, ZBlobFileList } from "./fileList.js";
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

const FILE_MAX_SIZE = 1024 * 1024 * 1;
const TOTAL_MAX_SIZE = 1024 * 1024 * 2;
const MAX_FILE_COUNT = 100;
export function validateFileList(fileList: BlobFileList) {
  const errors: string[] = [];
  if (fileList.length === 0) {
    errors.push("No files in tree");
  } else if (fileList.length > MAX_FILE_COUNT) {
    errors.push("Too many files in tree");
  } else {
    // make sure that:
    // - no individual file exceeds FILE_MAX_SIZE
    // - total size of all files does not exceed TOTAL_MAX_SIZE
    // - no duplicate file names under case insensitive comparison
    const seenFiles = new Set<string>();
    let totalSize = 0;
    for (const child of fileList) {
      if (seenFiles.has(child.path.toLowerCase())) {
        errors.push(`Duplicate case-insensitive file name: ${child.path}`);
      }
      totalSize += child.size;
      if (child.size > FILE_MAX_SIZE) {
        errors.push(
          `File too large: ${child.path} (${child.size}; limit ${FILE_MAX_SIZE})`,
        );
      }
    }
    if (totalSize > TOTAL_MAX_SIZE) {
      errors.push(
        `Total size too large (${totalSize}; limit ${TOTAL_MAX_SIZE})`,
      );
    }
  }
  return errors;
}
