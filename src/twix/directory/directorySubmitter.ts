import { AxiosError } from "axios";
import { nextTick } from "node:process";
import pLimit from "p-limit";
import { default as picomatch } from "picomatch";
import { z } from "zod";
import { ZBlobHash, ZBlobSchema } from "../../common/blobSchemas.js";
import { ApiError, getErrorInfo } from "../../common/errors.js";
import {
  PartialExtensionOriginGithub,
  ZExtensionOrigin,
  ZExtensionOriginGithub,
  ZExtensionSubmission,
  ZPartialExtensionOriginGithub,
} from "../../common/extensionSchemas.js";
import { BlobFileList } from "../../common/fileList.js";
import { ZSaneIdentifier, ZSaneString } from "../../common/saneSchemas.js";
import { sleep } from "../../common/sleep.js";
import { ActivityLog } from "../activityLog";
import { restClient as gh } from "../githubClient.js";
import { getRolo } from "../rolo.js";
import {
  GithubBlobNode,
  GithubCommitObject,
  GithubNode,
  GithubTagCreateEvent,
  ZGithubBlob,
  ZGithubCommitObject,
  ZGithubNode,
  ZGithubRefObject,
  ZGithubTree,
} from "../githubTypes.js";

const AUTH_KIND = "test";

// webhook param
const ZGlobPatternArray = z.union([
  ZSaneString.transform((str) => [str]),
  z.array(ZSaneString),
]);
export const ZWebhookParams = z.object({
  include: ZGlobPatternArray.optional(),
  exclude: ZGlobPatternArray.optional(),
  tagPrefix: ZSaneIdentifier.optional(),
});
export type WebhookParams = z.infer<typeof ZWebhookParams>;

export async function processTagEvent(
  tagInfo: GithubTagCreateEvent,
  params: WebhookParams,
  alog: ActivityLog,
): Promise<boolean> {
  alog.log(`Repo: ${tagInfo.repository.full_name}`);
  alog.log(`Tag: ${tagInfo.ref}`);

  // make sure the repo is public
  if (tagInfo.repository.private) {
    throw new ApiError(400, "The repo must be public");
  }

  // get the tree for the tag
  alog.log("Fetching tree");
  const { data } = await gh().get(
    `/repos/${tagInfo.repository.full_name}/git/trees/${tagInfo.ref}`,
    { params: { recursive: 1 } },
  );

  // validate the tree
  const tree = ZGithubTree.parse(data);
  alog.log(`Received tree ${tree.sha} with ${tree.tree.length} entries`);
  if (tree.truncated) {
    throw new ApiError(400, "The tree is truncated; repo is too large");
  }

  // list of nodes to be processed
  let matchingNodes: GithubNode[] = [];

  // if include rules are defined, get the matching nodes
  if (!params.include) {
    throw new ApiError(
      400,
      "At least one include pattern must be defined in the webhook query",
    );
  }

  if (params.include.length === 1 && params.include[0] === ".") {
    alog.log("Treating repo root as package directory");
    matchingNodes.push({
      type: "tree",
      path: "",
      mode: "040000",
      sha: tree.sha,
    });
  } else {
    const includers = params.include.map((pat) => picomatch(pat));
    const excluders = params.exclude?.map((pat) => picomatch(pat)) ?? [];
    for (const node of tree.tree) {
      if (
        includers.some((match) => match(node.path)) &&
        !excluders.some((match) => match(node.path))
      ) {
        matchingNodes.push(node);
      }
    }
  }

  // enforce a limit on the number of paths
  alog.log(`Matched ${matchingNodes.length} paths`);
  const MAX_PATHS = 200;
  if (matchingNodes.length > MAX_PATHS) {
    throw new ApiError(400, `Too many paths (max ${MAX_PATHS})`);
  }
  if (matchingNodes.length === 0) {
    throw new ApiError(400, "No matching paths");
  }

  // check which nodes are already processed
  const { data: extensionData } = await getRolo(AUTH_KIND).get("extensions", {
    params: {
      "origin.nodeSha": matchingNodes.map((node) => node.sha).join(","),
      format: "json",
      extract: "origin.nodeSha",
      limit: matchingNodes.length,
    },
  });
  const gotNodeShas = new Set(z.array(ZBlobHash).parse(extensionData));
  matchingNodes = matchingNodes.filter((node) => !gotNodeShas.has(node.sha));
  if (matchingNodes.length === 0) {
    alog.log("All nodes are already in the database");
    return false;
  }
  alog.log(`${gotNodeShas.size} nodes are already in the database`);
  alog.log(`Processing ${matchingNodes.length} new nodes`);

  // get the ref info to find the commit sha
  const refResponse = await gh().get(
    `/repos/${tagInfo.repository.full_name}/git/matching-refs/tags/${tagInfo.ref}`,
  );
  const refObjects = z.array(ZGithubRefObject).parse(refResponse.data);
  if (refObjects.length !== 1) {
    throw new ApiError(400, "Expected exactly one referenced object for tag");
  }
  // get the commit info
  const commitResponse = await gh().get(
    `/repos/${tagInfo.repository.full_name}/git/commits/${refObjects[0].object.sha}`,
  );
  const commitInfo = ZGithubCommitObject.parse(commitResponse.data);
  alog.log(`Loaded commit info:`, commitInfo);

  // create the partial origin object
  const partialOrigin = ZPartialExtensionOriginGithub.parse({
    type: "githubRepo",
    repoId: tagInfo.repository.id,
    repoName: tagInfo.repository.full_name,
    repoOwnerId: tagInfo.repository.owner.id,
    repoOwnerHandle: tagInfo.repository.owner.login,
    repoOwnerType: tagInfo.repository.owner.type,
    repoUrl: tagInfo.repository.html_url,
    commitSha: commitInfo.sha,
  });

  // use nexttick so that we return a webhook response before
  // beginning the processing
  nextTick(async () => {
    const limit = pLimit(10);
    const errors: string[] = [];
    await Promise.all(
      matchingNodes.map((node) =>
        limit(async () => {
          try {
            const files = getPackageFiles(node, tree.tree, alog);
            await processPackage(partialOrigin, node, files, alog);
          } catch (err) {
            const info = getErrorInfo(err);
            const path = node?.path ?? "<root>";
            errors.push(`* Path ${path}:\n[${info.type}]\n${info.message}`);
            alog.log(
              `Error processing node ${path}:\n[${info.type}]\n${info.message}`,
            );
            if (err instanceof AxiosError) {
              alog.log("Request config:", err.config);
              alog.log(`Response status: ${err.response?.status}`);
              alog.log(`Response headers: ${err.response?.headers}`);
              alog.log("Response data:", err.response?.data);
            }
            if (err instanceof Error) {
              alog.log(`Stack:\n${err.stack}`);
            }
          }
        }),
      ),
    );
    await sleep(0);
    alog.log("All nodes processed");
    if (errors.length > 0) {
      alog.log(`There were errors with ${errors.length} nodes`);
      for (const error of errors) {
        alog.log(`\n${error}`);
      }
    } else {
      alog.log("No errors");
    }
  });
  return true;
}

function getPackageFiles(
  node: z.infer<typeof ZGithubNode>,
  tree: z.infer<typeof ZGithubNode>[],
  alog: ActivityLog,
) {
  let filtered: GithubBlobNode[] = [];
  if (node.type === "tree") {
    const rootPrefix = node.path ? `${node.path}/` : "";
    const matcher = picomatch(`${rootPrefix}**`);
    for (const entry of tree) {
      if (entry.type === "commit") {
        throw new ApiError(400, `Submodules are not supported: ${node.path}`);
      }
      if (entry.type === "blob") {
        if (entry.mode === "120000") {
          throw new ApiError(400, `Symlinks are not supported: ${entry.path}`);
        }
        const relativePath = entry.path.slice(rootPrefix.length);

        // hidden if any part of the path starts with . or _
        const parts = relativePath.split("/");
        const hidden = parts.some(
          (part) => part.startsWith(".") || part.startsWith("_"),
        );
        if (hidden) continue;

        // finally match the paths
        if (matcher(entry.path)) {
          filtered.push({ ...entry, path: relativePath });
        }
      }
    }
  } else if (node.type === "blob") {
    if (node.mode === "120000") {
      throw new ApiError(400, `Symlinks are not supported: ${node.path}`);
    }
    // prefix the filename with #popclip- to signal that it's a snippet
    filtered.push({
      ...node,
      path: node.path.startsWith("#popclip-")
        ? node.path
        : `#popclip-${node.path}`,
    });
  } else {
    throw new ApiError(400, `Node type '${node.type}' is not supported`);
  }
  return filtered;
}

// process list of files forming a package
// paths on input should be relative to package root
const FILE_MAX_SIZE = 1024 * 1024 * 1;
const TOTAL_MAX_SIZE = 1024 * 1024 * 2;
const MAX_FILE_COUNT = 100;
async function processPackage(
  partialOrigin: PartialExtensionOriginGithub,
  originNode: GithubNode,
  blobList: GithubBlobNode[],
  alog: ActivityLog,
) {
  // if no children, return
  if (blobList.length === 0) {
    throw new ApiError(400, "No non-hidden files found in tree");
  }
  // if too many children, return
  if (blobList.length > MAX_FILE_COUNT) {
    throw new ApiError(400, "Too many files in tree");
  }

  // now make sure that:
  // - no individual file exceeds FILE_MAX_SIZE
  // - total size of all files does not exceed TOTAL_MAX_SIZE
  // - no duplicate file names under case insensitive comparison
  const errors: string[] = [];
  const seenFiles = new Set<string>();
  let totalSize = 0;
  for (const child of blobList) {
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
    errors.push(`Total size too large (${totalSize}; limit ${TOTAL_MAX_SIZE})`);
  }
  if (errors.length > 0) {
    throw new ApiError(400, errors.join("\n"));
  }

  // now we can process the files
  // check which files are already in the blob store
  const { data } = await getRolo(AUTH_KIND).get("blobs", {
    params: {
      hash: blobList.map((child) => child.sha).join(","),
      format: "json",
      extract: "hash",
      limit: blobList.length,
    },
  });
  const gotHashes = new Set(z.array(ZBlobHash).parse(data));

  // upload any that are not already in the blob store
  const files: BlobFileList = [];
  async function getFile(node: z.infer<typeof ZGithubNode>) {
    if (node.type !== "blob") {
      throw new Error("Invalid node type");
    }
    if (gotHashes.has(node.sha)) {
      //alog.log(`Skipping existing blob: ${node.path}`);
    } else {
      //alog.log(`Downloading blob from GitHub: ${node.path}`);
      const ghResponse = await gh().get(
        `/repos/${partialOrigin.repoName}/git/blobs/${node.sha}`,
      );
      const ghBlob = ZGithubBlob.parse(ghResponse.data);
      if (ghBlob.sha !== node.sha) {
        throw new Error("GitHub hash mismatch");
      }
      alog.log(
        //`Uploading blob to database: ${node.path} ${ghBlob.size} bytes ${ghBlob.sha}`,
      );
      const dbResponse = await getRolo(AUTH_KIND).post("blobs", {
        data: ghBlob.content,
      });
      const dbBlob = ZBlobSchema.parse(dbResponse.data);
      if (dbBlob.hash !== node.sha) {
        throw new Error("DB hash mismatch");
      }
    }

    // at this point the blob is in the database, so we can add it to the list
    files.push({
      path: node.path,
      hash: node.sha,
      executable: node.mode === "100755" ? true : undefined,
    });
  }

  // build the file list
  const limit = pLimit(5);
  await Promise.all(blobList.map((node) => limit(getFile, node)));

  // print something
  alog.log(
    `Gathered ${files.length} files for ${originNode.type} at '${originNode.path}':`,
  );
  for (const file of files.sort((a, b) =>
    a.path.localeCompare(b.path, "en-US", { sensitivity: "accent" }),
  )) {
    alog.log(`  ${file.path}`);
  }

  const origin = ZExtensionOriginGithub.parse({
    ...partialOrigin,
    nodeSha: originNode.sha,
    nodePath: originNode.path,
    nodeType: originNode.type,
  });
  const version = "0";

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
