import { AxiosError } from "axios";
import { nextTick } from "node:process";
import pLimit from "p-limit";
import { default as picomatch } from "picomatch";
import { z } from "zod";
import { ApiError, getErrorInfo } from "../../common/errors.js";
import {
  ZExtensionOriginGithubRepo,
  githubAuthorInfoFromUser,
} from "../../common/extensionSchemas.js";
import { ZSaneIdentifier, ZSaneString } from "../../common/saneSchemas.js";
import { sleep } from "../../common/sleep.js";
import { ActivityLog } from "../activityLog";
import { restClient as gh } from "../githubClient.js";
import {
  GithubBlobNode,
  GithubNode,
  GithubTagCreateEvent,
  ZGithubCommitObject,
  ZGithubNode,
  ZGithubRefObject,
  ZGithubTree,
  ZGithubUser,
} from "../../common/githubTypes.js";
import { VersionString, ZVersionString } from "../../common/versionString.js";
import {
  PackageFile,
  existingExtensions,
  submitPackage,
} from "./submitPackage.js";
import { log } from "../../common/log.js";

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

  // fetch user info
  const userResponse = await gh().get(
    `/users/${tagInfo.repository.owner.login}`,
  );
  const user = ZGithubUser.parse(userResponse.data);

  // create author object
  const author = githubAuthorInfoFromUser(user);
  alog.log("Author:", author);

  // create the partial origin object
  const partialOrigin = {
    type: "githubRepo",
    repoId: tagInfo.repository.id,
    repoName: tagInfo.repository.name,
    ownerId: tagInfo.repository.owner.id,
    ownerHandle: tagInfo.repository.owner.login,
    commitSha: commitInfo.sha,
    commitDate: commitInfo.committer.date,
  };
  alog.log("Origin:", partialOrigin);

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
            await submitPackage(
              ZExtensionOriginGithubRepo.parse({
                ...partialOrigin,
                nodePath: node.path,
                nodeSha: node.sha,
                nodeType: node.type,
              }),
              author,
              version,
              files,
              node.path,
              alog,
            );
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
): PackageFile[] {
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

        // hidden if any part of the path starts with . or _
        // TODO: move this to the extension signer stage
        // const parts = relativePath.split("/");
        // const hidden = parts.some(
        //   (part) => part.startsWith(".") || part.startsWith("_"),
        // );
        // if (hidden) {
        //   alog.log(`Warning, ignoring hidden file: ${entry.path}`);
        //   continue;
        // }

        // don't allow symlinks in packages
        if (entry.mode === "120000") {
          throw new ApiError(400, `Symlinks are not supported: ${entry.path}`);
        }

        // finally match the paths
        filtered.push({ ...entry, path: relativePath });
      }
    }
  } else if (node.type === "blob") {
    if (node.mode === "120000") {
      throw new ApiError(400, `Symlinks are not supported: ${node.path}`);
    }
    filtered.push(node);
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
