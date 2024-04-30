import pLimit from "p-limit";
import { z } from "zod";
import {
  ZBlobHash,
  ZBlobHash2,
  ZBlobSchema,
  gitHash,
} from "../../common/blobSchemas.js";
import {
  ExtensionOrigin,
  ExtensionSubmission,
  ZExtensionSubmission,
  canonicalSort,
  validateFileList,
} from "../../common/extensionSchemas.js";
import { ZCoreFileListEntry } from "../../common/fileList.js";
import { ZGithubBlob } from "../../common/githubTypes.js";
import { VersionString } from "../../common/versionString.js";
import { ActivityLog } from "../activityLog.js";
import { restClient as gh } from "../githubClient.js";
import { getRolo } from "../rolo.js";

const AUTH_KIND = "test";

export const ZGitSha1File = ZCoreFileListEntry.extend({
  type: z.literal("gitSha1File"),
  hash: ZBlobHash,
  content: z.instanceof(Buffer).optional(),
});
export type GitSha1File = z.infer<typeof ZGitSha1File>;

export const ZGitSha256File = ZCoreFileListEntry.extend({
  type: z.literal("gitSha256File"),
  hash: ZBlobHash2,
  content: z.instanceof(Buffer).optional(),
});
export type GitSha256File = z.infer<typeof ZGitSha256File>;

export const ZPackageFile = z.discriminatedUnion("type", [
  ZGitSha1File,
  ZGitSha256File,
]);
export type PackageFile = z.infer<typeof ZPackageFile>;

// given a list of hashes, return a set of hashes that we already have
// in the database for the given field
export async function existingExtensions(
  field: "origin.nodeSha" | "origin.commitSha" | "digest",
  values: string[],
) {
  const { data } = await getRolo(AUTH_KIND).get("extensions", {
    params: {
      [field]: values.join(","),
      format: "json",
      extract: field,
      limit: values.length,
    },
  });
  return new Set(z.array(ZBlobHash).parse(data));
}

// get a list of which files are already have in the blob store
// NOTE this mutates the fileList objects to add the hash field if it's missing
export async function existingBlobs(fileList: PackageFile[]) {
  const { data } = await getRolo(AUTH_KIND).get("blobs", {
    params: {
      hash: [...new Set(fileList.map((child) => child.hash))].join(","),
      limit: fileList.length,
    },
  });
  return new Map(
    z
      .object({
        object: z.literal("list"),
        items: z.array(
          z.object({
            h1: ZBlobHash,
            h2: ZBlobHash2,
          }),
        ),
      })
      .parse(data)
      .items.flatMap((item) => [
        [item.h1, item],
        [item.h2, item],
      ]),
  );
}

// process list of files forming a package
// paths on input should be relative to package root
export async function submitPackage(
  origin: ExtensionOrigin,
  version: VersionString,
  fileList: PackageFile[],
  displayName: string,
  alog: ActivityLog,
) {
  const errors = validateFileList(fileList);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const gotHashes = await existingBlobs(fileList);
  const processedFiles: GitSha256File[] = [];
  async function processFile(file: PackageFile) {
    const existing = gotHashes.get(file.hash);
    let processedFile: GitSha256File;
    if (file.content) {
      if (file.type !== "gitSha256File") {
        throw new Error("Internal: file must not have content");
      }
      processedFile = file;
    } else {
      if (file.type !== "gitSha1File") {
        throw new Error("Internal: file must have content");
      }
      if (origin.type !== "githubRepo") {
        throw new Error("gitSha1File must have githubRepo origin");
      }
      if (existing) {
        processedFile = {
          ...file,
          type: "gitSha256File" as const,
          hash: existing.h2,
        };
      } else {
        const ghResponse = await gh().get(
          `/repos/${origin.repoName}/git/blobs/${file.hash}`,
        );
        const ghBlob = ZGithubBlob.parse(ghResponse.data);
        const content = Buffer.from(ghBlob.content, "base64");
        if (content.length !== ghBlob.size || content.length !== file.size) {
          throw new Error("Size mismatch");
        }
        if (gitHash(content, "sha1").toString("hex") !== file.hash) {
          throw new Error("Hash mismatch");
        }
        processedFile = {
          ...file,
          type: "gitSha256File" as const,
          content,
          hash: gitHash(content, "sha256").toString("hex"),
        };
      }
    }

    // upload if we have new content
    if (!existing && processedFile?.content) {
      const dbResponse = await getRolo(AUTH_KIND).post("blobs", {
        data: processedFile.content.toString("base64"),
      });
      const dbBlob = ZBlobSchema.parse(dbResponse.data);
      if (dbBlob.size !== processedFile.size) {
        throw new Error("Size mismatch");
      }
    }
    processedFiles.push(processedFile);
  }

  // build the file list
  const limit = pLimit(5);
  await Promise.all(fileList.map((node) => limit(processFile, node)));
  canonicalSort(processedFiles);

  // print something
  alog.log(`Gathered ${processedFiles.length} files for '${displayName}':`);
  for (const node of processedFiles) {
    alog.log(`  ${node.path}`);
  }
  alog.log(`Version: ${version}`);

  // now we have all the files we need to submit the package
  const submission: ExtensionSubmission = {
    origin,
    version,
    files: processedFiles,
  };
  const submissionResponse = await getRolo(AUTH_KIND).post(
    "extensions",
    ZExtensionSubmission.parse(submission),
  );
  // submissionResponse.data.files = `${submission.files.length} files`;
  alog.log(`Submitted package. Response:`, submissionResponse.data);
}
