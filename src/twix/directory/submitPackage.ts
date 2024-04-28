import pLimit from "p-limit";
import { z } from "zod";
import { ZBlobHash, ZBlobSchema } from "../../common/blobSchemas.js";
import { ApiError } from "../../common/errors.js";
import {
  ExtensionOrigin,
  ZExtensionSubmission,
  validateFileList,
} from "../../common/extensionSchemas.js";
import { BlobFileList, ZBlobFileListEntry } from "../../common/fileList.js";
import { ZGithubBlob } from "../../common/githubTypes.js";
import { VersionString } from "../../common/versionString.js";
import { ActivityLog } from "../activityLog.js";
import { restClient as gh } from "../githubClient.js";
import { getRolo } from "../rolo.js";

const AUTH_KIND = "test";

export const ZPackageNode = ZBlobFileListEntry.extend({
  contentBase64: z.string().optional(),
});
export type PackageNode = z.infer<typeof ZPackageNode>;

// process list of files forming a package
// paths on input should be relative to package root
export async function submitPackage(
  origin: ExtensionOrigin,
  version: VersionString,
  fileList: PackageNode[],
  displayName: string,
  alog: ActivityLog,
) {
  const errors = validateFileList(fileList);
  if (errors.length > 0) {
    throw new ApiError(400, errors.join("\n"));
  }
  // get a list of hashes we already have
  const { data } = await getRolo(AUTH_KIND).get("blobs", {
    params: {
      hash: fileList.map((child) => child.hash).join(","),
      format: "json",
      extract: "hash",
      limit: fileList.length,
    },
  });
  const gotHashes = new Set(z.array(ZBlobHash).parse(data));

  const files: BlobFileList = [];
  async function getFile(node: PackageNode) {
    if (gotHashes.has(node.hash)) {
      //alog.log(`Skipping existing blob: ${node.path}`);
      return;
    }
    if (!node.contentBase64) {
      if (origin.type !== "githubRepo") {
        throw new Error("Missing content only allowed for GitHub repos");
      }
      //alog.log(`Downloading blob from GitHub: ${node.path}`);
      const ghResponse = await gh().get(
        `/repos/${origin.repoName}/git/blobs/${node.hash}`,
      );
      const ghBlob = ZGithubBlob.parse(ghResponse.data);
      if (ghBlob.sha !== node.hash) {
        throw new Error("GitHub hash mismatch");
      }
      if (ghBlob.size !== node.size) {
        throw new Error("GitHub size mismatch");
      }
      node.contentBase64 = ghBlob.content;
    }

    alog.log(
      //`Uploading blob to database: ${node.path} ${node.size} bytes ${node.sha}`,
    );
    const dbResponse = await getRolo(AUTH_KIND).post("blobs", {
      data: node.contentBase64,
    });
    const dbBlob = ZBlobSchema.parse(dbResponse.data);
    if (dbBlob.hash !== node.hash) {
      throw new Error("DB hash mismatch");
    }

    // at this point the blob is in the database, so we can add it to the list
    files.push({
      path: node.path,
      hash: node.hash,
      size: node.size,
      executable: node.executable ? true : undefined,
    });
  }

  // build the file list
  const limit = pLimit(5);
  await Promise.all(fileList.map((node) => limit(getFile, node)));

  // sort the files (this is not strictly necessary, but it makes the output more predictable)
  files.sort((a, b) =>
    a.path.localeCompare(b.path, "en-US", { sensitivity: "accent" }),
  );

  // print something
  alog.log(`Gathered ${files.length} files for '${displayName}':`);
  for (const file of files) {
    alog.log(`  ${file.path}`);
  }

  // now we have all the files we need to submit the package
  const submission = ZExtensionSubmission.parse({
    origin,
    files,
    version,
  });
  const submissionResponse = await getRolo(AUTH_KIND).post(
    "extensions",
    submission,
  );
  alog.log(`Submitted package. Response:`, submissionResponse.data);
}
