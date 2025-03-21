import { z } from "zod";
import { ZBlobHash1, ZBlobHash2 } from "./blobSchemas.js";
import { CoreFileList, ZCoreFileListEntry } from "./fileList.js";
import {
  NonNegativeSafeInteger,
  PositiveSafeInteger,
  ZLocalizableString,
  ZSaneDate,
  ZSaneIdentifier,
  ZSaneLongString,
  ZSaneString,
} from "./saneSchemas.js";
import { ZVersionString } from "./versionString.js";
import { GithubUser, ZGitHubUserType } from "./githubTypes.js";

export const ZExtensionAppInfo = z.object({
  name: ZSaneString,
  link: ZSaneString,
});
export type ExtensionAppInfo = z.infer<typeof ZExtensionAppInfo>;

const ZIconComponents = z.object({
  prefix: ZSaneString,
  payload: ZSaneLongString,
  modifiers: z.record(z.unknown()),
});
export type IconComponents = z.infer<typeof ZIconComponents>;

export const ZExtensionInfo = z.object({
  type: z.literal("popclip"),
  name: ZLocalizableString,
  identifier: ZSaneIdentifier,
  description: ZLocalizableString,
  keywords: ZSaneString.optional(),
  icon: ZIconComponents.optional(),
  actionTypes: z.array(ZSaneString),
  entitlements: z.array(ZSaneString).optional(),
  apps: z.array(ZExtensionAppInfo).optional(),
  macosVersion: ZSaneString.optional(),
  popclipVersion: PositiveSafeInteger.optional(),
});
export type ExtensionInfo = z.infer<typeof ZExtensionInfo>;

export const ZGithubAuthorInfo = z.object({
  type: z.literal("github"),
  githubId: NonNegativeSafeInteger,
  githubHandle: ZSaneString,
  githubType: ZGitHubUserType,
  githubUrl: ZSaneString,
  websiteUrl: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  bio: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
});
export type GithubAuthorInfo = z.infer<typeof ZGithubAuthorInfo>;

export const ZExtensionFileListEntry = ZCoreFileListEntry.extend({
  hash: ZBlobHash2,
  data: z.instanceof(Buffer).optional(),
});
export type ExtensionFileListEntry = z.infer<typeof ZExtensionFileListEntry>;

export const ZExtensionFileList = z.array(ZExtensionFileListEntry);
export type ExtensionFileList = z.infer<typeof ZExtensionFileList>;

export const ZExtensionOriginGithubRepoPartial = z.object({
  type: z.literal("githubRepoPartial"),
  repoId: NonNegativeSafeInteger,
  repoName: ZSaneString,
  ownerId: NonNegativeSafeInteger,
  ownerHandle: ZSaneString,
  nodePath: z.string(),
  nodeSha: ZBlobHash1,
  nodeType: z.enum(["blob", "tree", "commit"]),
});
export type ExtensionOriginGithubRepoPartial = z.infer<
  typeof ZExtensionOriginGithubRepoPartial
>;

export const ZExtensionOriginGithubRepo =
  ZExtensionOriginGithubRepoPartial.extend({
    type: z.literal("githubRepo"),
    commitSha: ZBlobHash1,
    commitDate: ZSaneDate,
    commitMessage: z.string(),
  });
export type ExtensionOriginGithubRepo = z.infer<
  typeof ZExtensionOriginGithubRepo
>;

export const ZExtensionOriginGithubGist = z.object({
  type: z.literal("githubGist"),
  gistId: ZSaneString,
  ownerId: NonNegativeSafeInteger,
  ownerHandle: ZSaneString,
  commitSha: ZBlobHash1,
  commitDate: ZSaneDate,
});

export const ZExtensionOrigin = z.discriminatedUnion("type", [
  ZExtensionOriginGithubRepoPartial,
  ZExtensionOriginGithubRepo,
  ZExtensionOriginGithubGist,
]);
export type ExtensionOrigin = z.infer<typeof ZExtensionOrigin>;

export const ZExtensionSubmission = z.object({
  version: ZVersionString.nullable(),
  origin: ZExtensionOrigin,
  author: ZGithubAuthorInfo,
  files: ZExtensionFileList,
});
export type ExtensionSubmission = z.infer<typeof ZExtensionSubmission>;

// what can be patched in an extension
export const ZExtensionPatch = z.object({
  published: z.boolean().optional(),
  unlisted: z.boolean().optional(),
  reviewed: z.boolean().optional(),
  reviewComments: z.string().optional(),
  allowOriginChange: z.boolean().optional(),
  allowLowerVersion: z.boolean().optional(),
});
export type ExtensionPatch = z.infer<typeof ZExtensionPatch>;

export const ZPartialExtensionRecord = ZExtensionPatch.extend({
  object: z.literal("extension"),
  created: z.coerce.date(),
  shortcode: z.string(),
  version: ZVersionString,
  info: ZExtensionInfo,
  origin: ZExtensionOrigin,
  files: ZExtensionFileList,
});
export type PartialExtensionRecord = z.infer<typeof ZPartialExtensionRecord>;

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

export function githubAuthorInfoFromUser(user: GithubUser): GithubAuthorInfo {
  return {
    type: "github",
    githubId: user.id,
    githubHandle: user.login,
    githubType: user.type,
    githubUrl: user.html_url,
    websiteUrl: user.blog ?? undefined,
    name: user.name ?? undefined,
    email: user.email ?? undefined,
    bio: user.bio ?? undefined,
    company: user.company ?? undefined,
    location: user.location ?? undefined,
  };
}
