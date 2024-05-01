import { z } from "zod";
import { ZBlobHash, ZBlobHash2 } from "./blobSchemas.js";
import { CoreFileList, ZCoreFileListEntry } from "./fileList.js";
import {
  NonNegativeSafeInteger,
  ZSaneDate,
  ZSaneString,
} from "./saneSchemas.js";
import { ZVersionString } from "./versionString.js";
import { ZGitHubUserType } from "./githubTypes.js";
import { createHash } from "node:crypto";

export const ZExtensionFileListEntry = ZCoreFileListEntry.extend({
  hash: ZBlobHash2,
});
export const ZExtensionFileList = z.array(ZExtensionFileListEntry);
export type ExtensionFileList = z.infer<typeof ZExtensionFileList>;

export const ZExtensionDataFileListEntry = ZExtensionFileListEntry.extend({
  data: z.instanceof(Buffer),
});
export type ExtensionDataFileListEntry = z.infer<
  typeof ZExtensionDataFileListEntry
>;
export const ZExtensionDataFileList = z.array(ZExtensionDataFileListEntry);
export type ExtensionDataFileList = z.infer<typeof ZExtensionDataFileList>;

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
  version: ZVersionString.nullable(),
  origin: ZExtensionOrigin,
  files: ZExtensionFileList,
});
export type ExtensionSubmission = z.infer<typeof ZExtensionSubmission>;

// what can be patched in an extension
export const ZExtensionPatch = z.object({
  published: z.boolean().optional(),
  allowOriginChange: z.boolean().optional(),
});
export type ExtensionPatch = z.infer<typeof ZExtensionPatch>;

export function isConfigFileName(name: string) {
  return /^Config(?:[.][^.\/]+)?$/.test(name);
}

const FILE_MAX_SIZE = 1024 * 1024 * 1;
const TOTAL_MAX_SIZE = 1024 * 1024 * 2;
const MAX_FILE_COUNT = 100;
export function validateFileList(fileList: CoreFileList) {
  const errors: string[] = [];
  if (fileList.length === 0) {
    errors.push("No files in tree");
  } else if (fileList.length > MAX_FILE_COUNT) {
    errors.push(
      `Too many files in tree (${fileList.length}; limit ${MAX_FILE_COUNT})`,
    );
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
      seenFiles.add(child.path.toLowerCase());
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

// this is equivalent to the original extension objc-c digest algorithm
// sort order
export function canonicalSort(fileList: CoreFileList) {
  fileList.sort((a, b) =>
    a.path.localeCompare(b.path, "en-US", {
      sensitivity: "accent",
      caseFirst: "upper",
    }),
  );
}

// this is the "internal" digest, not the one used for extension signing
// which requires the full contents of each file to be hashed
export function calculateDigest(fileList: ExtensionFileList) {
  canonicalSort(fileList);
  const hasher = createHash("sha256");
  hasher.update(`files ${fileList.length}\0`);
  for (const file of fileList) {
    hasher.update(`${file.hash} ${file.executable ? "1" : "0"} ${file.path}\0`);
  }
  return hasher.digest();
}
