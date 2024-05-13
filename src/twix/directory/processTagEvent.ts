import path from "node:path";
import { nextTick } from "node:process";
import pLimit from "p-limit";
import { default as picomatch } from "picomatch";
import { z } from "zod";
import { ApiError, getErrorInfo } from "../../common/errors.js";
import {
  ExtensionOrigin,
  ExtensionOriginGithubRepo,
  ZExtensionOriginGithubRepo,
  ZExtensionOriginGithubRepoPartial,
  githubAuthorInfoFromUser,
} from "../../common/extensionSchemas.js";
import {
  GithubBlobNode,
  GithubNode,
  GithubTagCreateEvent,
  ZGithubBlob,
  ZGithubCommitListEntry,
  ZGithubCommitObject,
  ZGithubRefObject,
  ZGithubTree,
  ZGithubUser,
} from "../../common/githubTypes.js";
import { ZSaneIdentifier, ZSaneString } from "../../common/saneSchemas.js";
import { sleep } from "../../common/sleep.js";
import { VersionString, ZVersionString } from "../../common/versionString.js";
import { ActivityLog } from "../activityLog";
import { restClient as gh } from "../githubClient.js";
import {
  RepoTagEvent,
  SubmissionResult,
  describeResultArray,
} from "../../common/events.js";
import {
  EXTENSION_SUBMITTER_AUTH_KIND,
  PackageFile,
  existingExtensions,
  submitPackage,
} from "./submitPackage.js";
import { getRolo } from "../rolo.js";

// webhook param
const ZGlobPatternArray = z.union([
  ZSaneString.transform((str) => [str]),
  z.array(ZSaneString),
]);
export const ZDirectoryWebhookParams = z.object({
  include: ZGlobPatternArray.optional(),
  exclude: ZGlobPatternArray.optional(),
  versionPrefix: ZSaneIdentifier.optional(),
});
export type DirectoryWebhookParams = z.infer<typeof ZDirectoryWebhookParams>;

function parseVersion(tag: string, prefix: string): VersionString {
  if (!tag.startsWith(prefix)) {
    throw new ApiError(400, `Tag ${tag} does not start with ${prefix}`);
  }
  const version = tag.slice(prefix.length);
  const result = ZVersionString.safeParse(version);
  if (!result.success) {
    throw new ApiError(400, `Invalid version string: ${version}`);
  }
  return result.data;
}

export async function processTagEvent(
  tagInfo: GithubTagCreateEvent,
  params: DirectoryWebhookParams,
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

  // parse the version from the tag name
  const version = parseVersion(tagInfo.ref, params.versionPrefix ?? "");

  // list of nodes to be processed
  const matchingNodes: GithubNode[] = [];

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
  const MAX_PATHS = 300;
  if (matchingNodes.length > MAX_PATHS) {
    throw new ApiError(400, `Too many paths (max ${MAX_PATHS})`);
  }
  if (matchingNodes.length === 0) {
    throw new ApiError(400, "No matching paths");
  }

  // check which nodes are already processed
  const gotNodeShas = await existingExtensions(
    "origin.nodeSha",
    matchingNodes.map((n) => n.sha),
  );
  const newNodes = matchingNodes.filter((node) => !gotNodeShas.has(node.sha));
  if (matchingNodes.length === 0) {
    alog.log("All nodes are already in the database");
    return false;
  }
  alog.log(`${gotNodeShas.size} nodes are already in the database`);
  alog.log(`Processing ${newNodes.length} new nodes`);

  // get the ref info to find the commit sha
  const refResponse = await gh().get(
    `/repos/${tagInfo.repository.full_name}/git/ref/tags/${tagInfo.ref}`,
  );
  const refObject = ZGithubRefObject.parse(refResponse.data);

  // get the commit info
  const taggedCommitResponse = await gh().get(
    `/repos/${tagInfo.repository.full_name}/git/commits/${refObject.object.sha}`,
  );
  const taggedCommitInfo = ZGithubCommitObject.parse(taggedCommitResponse.data);
  alog.log(`Loaded tagged commit info:`, taggedCommitInfo);

  // fetch user info
  const userResponse = await gh().get(
    `/users/${tagInfo.repository.owner.login}`,
  );
  const user = ZGithubUser.parse(userResponse.data);

  // create author object
  const author = githubAuthorInfoFromUser(user);
  alog.log("Author:", author);

  // use nexttick so that we return a webhook response before
  // beginning the processing
  const results: SubmissionResult[] = [];
  nextTick(async () => {
    const limit = pLimit(10);
    await Promise.all(
      newNodes.map((node) =>
        limit(async () => {
          let origin: ExtensionOrigin = {
            type: "githubRepoPartial",
            repoId: tagInfo.repository.id,
            repoName: tagInfo.repository.name,
            ownerId: tagInfo.repository.owner.id,
            ownerHandle: tagInfo.repository.owner.login,
            nodePath: node.path,
            nodeSha: node.sha,
            nodeType: node.type,
          };
          try {
            origin = ZExtensionOriginGithubRepoPartial.parse(origin);
            let commit = await getChangeCommit(
              node,
              tagInfo.repository.full_name,
              taggedCommitInfo.sha,
            );
            origin = ZExtensionOriginGithubRepo.parse({
              ...origin,
              type: "githubRepo",
              commitSha: commit.sha,
              commitDate: commit.date,
              commitMessage: commit.message,
            });
            let files = await getPackageFiles(
              node,
              tree.tree,
              tagInfo.repository.full_name,
              alog,
            );
            results.push(
              await submitPackage(
                origin,
                author,
                version,
                files,
                node.path,
                alog,
              ),
            );
          } catch (err) {
            let { stack, innerMessage, ...errorInfo } = getErrorInfo(err);
            alog.log(
              `** Failed preparing to submit ${node.path} due to error:\n[${errorInfo.type}] ${errorInfo.message}`,
            );
            results.push({
              status: "error",
              origin,
              details: {
                type: "https://pilotmoon.com/api-errors#prepare-tagged-package",
                title: "Failed to prepare package for submission",
                detail: innerMessage ?? errorInfo.message,
                errorInfo,
              },
            });
          }
        }),
      ),
    );
    await sleep(0);
    alog.log("All nodes processed");
    alog.log(`The include directive matched ${matchingNodes.length} paths.`);
    alog.log(`There were changes to ${newNodes.length} of those paths.`);
    alog.log(describeResultArray(results));
    alog.log("Done");

    const event: RepoTagEvent = {
      type: "githubRepoTag",
      timestamp: alog.created,
      logUrl: alog.url ?? null,
      ownerHandle: tagInfo.repository.owner.login,
      repoName: tagInfo.repository.name,
      repoTag: tagInfo.ref,
      submissions: results,
    };
    await getRolo(EXTENSION_SUBMITTER_AUTH_KIND).post("events", event);
  });
  return true; // indicates that processin continues asynchronously
}

// if symlink is relative link to a blob in the repo, resolve it
// as a blob. if it's a link to a tree, non-relative, or outside
// the repo, throw error
async function resolveSymlink(
  entry: GithubBlobNode,
  tree: GithubNode[],
  repoFullName: string,
): Promise<GithubBlobNode> {
  // first fetch the blob content
  const blobResponse = await gh().get(
    `/repos/${repoFullName}/git/blobs/${entry.sha}`,
  );
  const blob = ZGithubBlob.parse(blobResponse.data);
  const symlinkPath = Buffer.from(blob.content, "base64").toString("utf-8");
  if (path.isAbsolute(symlinkPath)) {
    throw new ApiError(
      400,
      `Absolute symlink not supported: ${entry.path} => ${symlinkPath}`,
    );
  }
  const targetPath = path.join(path.dirname(entry.path), symlinkPath);
  if (targetPath.startsWith("../")) {
    throw new ApiError(
      400,
      `Symlink outside the repo not supported: ${entry.path} => ${symlinkPath}`,
    );
  }
  if (targetPath === entry.path) {
    throw new ApiError(
      400,
      `Symlink to itself not supported: ${entry.path} => ${symlinkPath}`,
    );
  }
  const matchingNode = tree.find((n) => n.path === targetPath);
  if (matchingNode) {
    if (matchingNode.type === "tree") {
      throw new ApiError(
        400,
        `Directory symlink not supported: ${entry.path} => ${symlinkPath}`,
      );
    }
    if (matchingNode.type === "blob") {
      if (matchingNode.mode === "120000") {
        throw new ApiError(
          400,
          `Symlink to a symlink not supported: ${entry.path} => ${symlinkPath}`,
        );
      }
      return matchingNode;
    }
  }
  throw new ApiError(
    400,
    `Could not resolve symlink: ${entry.path} => ${symlinkPath}`,
  );
}

async function getPackageFiles(
  node: GithubNode,
  tree: GithubNode[],
  repoFullName: string,
  alog: ActivityLog,
): Promise<PackageFile[]> {
  let filtered: GithubBlobNode[] = [];
  if (node.type === "tree") {
    const rootPrefix = node.path ? `${node.path}/` : "";
    for (const entry of tree) {
      if (!entry.path.startsWith(rootPrefix)) continue;
      if (entry.type === "commit") {
        throw new ApiError(400, `Submodules are not supported: ${node.path}`);
      }
      if (entry.type === "blob") {
        const relativePath = entry.path.slice(rootPrefix.length);
        if (entry.mode === "120000") {
          const resolved = await resolveSymlink(entry, tree, repoFullName);
          filtered.push({ ...resolved, path: relativePath });
        } else {
          filtered.push({ ...entry, path: relativePath });
        }
      }
    }
  } else if (node.type === "blob") {
    if (node.mode === "120000") {
      throw new ApiError(400, `Matched path may not be symlink: ${node.path}`);
    }
    filtered.push({ ...node, path: path.basename(node.path) });
  } else {
    throw new ApiError(400, `Node type '${node.type}' is not supported`);
  }
  return filtered.map((node) => {
    return {
      ...node,
      type: "gitSha1File",
      hash: node.sha,
      executable: node.mode === "100755" ? true : undefined,
    };
  });
}

// find the most recent commit in which the node was changed
async function getChangeCommit(
  node: GithubNode,
  repoFullName: string,
  fromSha: string,
) {
  // use github api to list commits for the node
  const commitsResponse = await gh().get(
    `/repos/${repoFullName}/commits?path=${node.path}&sha=${fromSha}`,
  );
  const commits = z
    .array(ZGithubCommitListEntry)
    .nonempty()
    .parse(commitsResponse.data);
  return {
    date: commits[0].commit.committer?.date ?? new Date("1970-01-01T00:00:00Z"),
    message: commits[0].commit.message,
    sha: commits[0].sha,
  };
}
