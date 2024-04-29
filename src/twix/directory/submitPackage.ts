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
  type: z.literal("gitSha1"),
  hash: ZBlobHash,
});
export type GitSha1File = z.infer<typeof ZGitSha1File>;

export const ZGitSha256File = ZCoreFileListEntry.extend({
  type: z.literal("gitSha256"),
  hash2: ZBlobHash2,
});
export type GitSha256File = z.infer<typeof ZGitSha256File>;

export const ZContentFile = ZCoreFileListEntry.extend({
  type: z.literal("content"),
  content: z.instanceof(Buffer),
  hash2: ZBlobHash2.optional(),
});
export type ContentFile = z.infer<typeof ZContentFile>;

export const ZPackageFile = z.discriminatedUnion("type", [
  ZGitSha1File,
  ZGitSha256File,
  ZContentFile,
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
export async function existingBlobs(fileList: PackageFile[]) {
  const { data } = await getRolo(AUTH_KIND).get("blobs", {
    params: {
      hash: [
        ...new Set(
          fileList.map((child) => {
            if (child.type === "gitSha1") {
              return child.hash;
            } else if (child.type === "gitSha256") {
              return child.hash2;
            } else if (child.type === "content") {
              child.hash2 = gitHash(child.content, "sha256");
              return child.hash2;
            }
          }),
        ),
      ].join(","),
      limit: fileList.length,
    },
  });
  return new Map(
    z
      .object({
        object: z.literal("list"),
        items: z.array(
          z.object({
            hash: ZBlobHash,
            hash2: ZBlobHash2,
          }),
        ),
      })
      .parse(data)
      .items.flatMap((item) => [
        [item.hash, item],
        [item.hash2, item],
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
    let newContentFile: ContentFile | undefined = undefined;
    if (file.type === "gitSha1") {
      if (origin.type !== "githubRepo") {
        throw new Error("gitSha1 node only allowed for GitHub repos");
      }
      const existing = gotHashes.get(file.hash);
      if (existing) {
        processedFiles.push({
          ...file,
          type: "gitSha256",
          hash2: existing.hash2,
        });
      } else {
        const ghResponse = await gh().get(
          `/repos/${origin.repoName}/git/blobs/${file.hash}`,
        );
        const ghBlob = ZGithubBlob.parse(ghResponse.data);
        const content = Buffer.from(ghBlob.content, "base64");
        const hash2 = gitHash(content, "sha256");
        newContentFile = { ...file, type: "content", content, hash2 };
        processedFiles.push({ ...file, type: "gitSha256", hash2 });
      }
    } else if (file.type === "content") {
      const hash2 = file.hash2 ?? gitHash(file.content, "sha256");
      const existing = gotHashes.get(hash2);
      if (!existing) {
        newContentFile = file;
      }
      processedFiles.push({
        ...file,
        type: "gitSha256",
        hash2,
      });
    } else if (file.type === "gitSha256") {
      throw new Error("gitSha256 node input not supported");
    }

    if (newContentFile) {
      const dbResponse = await getRolo(AUTH_KIND).post("blobs", {
        data: newContentFile.content.toString("base64"),
      });
      const dbBlob = ZBlobSchema.parse(dbResponse.data);
      if (dbBlob.size !== newContentFile.size) {
        throw new Error("Size mismatch");
      }
    }
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

  // now we have all the files we need to submit the package
  const submission = ZExtensionSubmission.parse({
    origin,
    version,
    files: processedFiles,
  });
  const submissionResponse = await getRolo(AUTH_KIND).post(
    "extensions",
    submission,
  );
  alog.log(`Submitted package. Response:`, submissionResponse.data);
}
