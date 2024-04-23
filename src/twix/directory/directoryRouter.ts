import { AxiosError } from "axios";
import { nextTick } from "node:process";
import pLimit from "p-limit";
import picomatch from "picomatch";
import { z } from "zod";
import { ZBlobHash } from "../../common/blobSchemas.js";
import { ApiError, getErrorInfo } from "../../common/errors.js";
import {
  ZExtensionOrigin,
  ZExtensionSubmission,
} from "../../common/extensionSchemas.js";
import { BlobFileList } from "../../common/fileList.js";
import {
  ZSaneDate,
  ZSaneEmail,
  ZSaneIdentifier,
  ZSaneString,
} from "../../common/saneSchemas.js";
import { sleep } from "../../common/sleep.js";
import { ActivityLog } from "../activityLog.js";
import { restClient as gh, githubWebhookValidator } from "../github.js";
import { makeRouter } from "../koaWrapper.js";
import { getRolo } from "../rolo.js";

const AUTH_KIND = "test";
export const router = makeRouter();

// the webhook payload for a tag creation
const ZGithubTagCreateEvent = z.object({
  ref_type: z.literal("tag"),
  ref: z.string(),
  repository: z.object({
    html_url: z.string(),
    id: z.number().int().safe().nonnegative(),
    name: z.string(),
    private: z.boolean(),
    full_name: z.string(),
    owner: z.object({
      login: z.string(),
      id: z.number().int().safe().nonnegative(),
      type: z.enum(["User", "Organization"]),
    }),
  }),
});
const ZGithubBranchCreateEvent = z.object({
  ref_type: z.literal("branch"),
  ref: z.string(),
});
const ZGithubRepoCreateEvent = z.object({
  ref_type: z.literal("repository"),
  ref: z.null(),
});

// these are the three possible ref types of `create` events
// as per https://docs.github.com/en/rest/using-the-rest-api/github-event-types?apiVersion=2022-11-28#createevent
const ZGithubPayload = z.union([
  ZGithubTagCreateEvent,
  ZGithubBranchCreateEvent,
  ZGithubRepoCreateEvent,
]);

const ZNonEmptyString = z.string().min(1);
//const ZQueryBool = z.string().transform((val) => val === "" || val === "1");
const ZGlobPatternArray = z.union([
  ZNonEmptyString.transform((str) => [str]),
  z.array(ZNonEmptyString),
]);
const ZWebhookParams = z.object({
  include: ZGlobPatternArray.optional(),
  exclude: ZGlobPatternArray.optional(),
  tagPrefix: ZSaneIdentifier.optional(),
});

const ZGitHubBaseNode = z.object({
  path: z.string(),
  sha: z.string(),
});
const ZGithubBlobNode = ZGitHubBaseNode.extend({
  type: z.literal("blob"),
  mode: z.enum(["100644", "100755", "120000"]),
  size: z.number().int().nonnegative(),
});
type GithubBlobNode = z.infer<typeof ZGithubBlobNode>;
const ZGithubTreeNode = ZGitHubBaseNode.extend({
  type: z.literal("tree"),
  mode: z.enum(["040000"]),
});
const ZGithubCommitNode = ZGitHubBaseNode.extend({
  type: z.literal("commit"),
  mode: z.enum(["160000"]),
});
const ZGithubNode = z.discriminatedUnion("type", [
  ZGithubBlobNode,
  ZGithubTreeNode,
  ZGithubCommitNode,
]);
type GithubNode = z.infer<typeof ZGithubNode>;

const ZGithubTree = z.object({
  sha: z.string(),
  tree: z.array(ZGithubNode),
  truncated: z.boolean(),
});

const ZGithubBlob = z.object({
  content: z.string(),
  encoding: z.literal("base64"),
  sha: z.string(),
  size: z.number().int().nonnegative(),
});

export const ZBlobSchema = z.object({
  id: z.string(),
  object: z.literal("blob"),
  hash: ZBlobHash,
});

const ZGithubRefObject = z.object({
  ref: z.string(),
  object: z.object({
    type: z.literal("commit"),
    sha: z.string(),
  }),
});

const ZGithubCommitObject = z.object({
  sha: z.string(),
  committer: z.object({
    name: ZSaneString,
    email: ZSaneEmail,
    date: ZSaneDate,
  }),
});

// const ZGistRequest = z.object({
//   gistUrl: z.string(),
// });

// router.post("/webhooks/gist", async (ctx) => {});

const GH_HOOK_PATH = "/webhooks/gh";
router
  .post(GH_HOOK_PATH, githubWebhookValidator("create"))
  .post(GH_HOOK_PATH, async (ctx) => {
    try {
      const params = ZWebhookParams.safeParse(ctx.request.query);
      if (!params.success) {
        ctx.alog.log("Invalid query parameters:", ctx.request.query);
        throw params.error;
      }
      const parsedBody = ZGithubPayload.safeParse(ctx.request.body);
      if (!parsedBody.success) {
        ctx.alog.log("Invalid GitHub webhook body:", ctx.request.body);
        throw parsedBody.error;
      }
      ctx.alog.log("Parsed GitHub payload:", parsedBody.data);
      if (parsedBody.data.ref_type === "tag") {
        const willProcessAsync = await processTag(
          parsedBody.data,
          params.data,
          ctx.alog,
        );
        if (willProcessAsync) {
          ctx.status = 202;
          ctx.alog.log(
            `Processing continues asynchronously; check remote log for results`,
          );
        } else {
          ctx.alog.log(`Processing completed synchronously`);
          ctx.status = 200;
        }
      } else {
        ctx.alog.log(`Ignoring ref type: ${parsedBody.data.ref_type}`);
        ctx.status = 200;
      }
    } catch (err) {
      const info = getErrorInfo(err);
      ctx.alog.log(`** Aborting due to error:\n[${info.type}] ${info.message}`);
      if (err instanceof AxiosError) {
        ctx.alog.log("Request config:", err.config);
        ctx.alog.log(`Response status: ${err.response?.status}`);
        ctx.alog.log(`Response headers: ${err.response?.headers}`);
        ctx.alog.log("Response data:", err.response?.data);
      }
      if (err instanceof Error) {
        ctx.alog.log(`Stack:\n${err.stack}`);
      }
      ctx.status = info.status;
    } finally {
      ctx.body = ctx.alog.getString();
    }
  });

async function processTag(
  tagInfo: z.infer<typeof ZGithubTagCreateEvent>,
  params: z.infer<typeof ZWebhookParams>,
  alog: ActivityLog,
): Promise<boolean> {
  alog.log("Parsed URL params:", params);
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
    alog.log("All paths are already in the database");
    return false;
  }
  alog.log(`Processing ${matchingNodes.length} new paths`);

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
  const commit = ZGithubCommitObject.parse(commitResponse.data);
  alog.log(`Loaded commit info:`, commit);

  // use nexttick so that we return a webhook response before
  // beginning the processing
  nextTick(async () => {
    const limit = pLimit(10);
    const errors: string[] = [];
    await Promise.all(
      matchingNodes.map((node) =>
        limit(async (node) => {
          try {
            const files = getPackageFiles(node, tree.tree, alog);
            await processPackage(tagInfo, commit, files, node, alog);
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
        }, node),
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
  tagInfo: z.infer<typeof ZGithubTagCreateEvent>,
  commitInfo: z.infer<typeof ZGithubCommitObject>,
  blobList: GithubBlobNode[],
  node: GithubNode,
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
        `/repos/${tagInfo.repository.full_name}/git/blobs/${node.sha}`,
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
    `Gathered ${files.length} files for ${node.type} at '${node.path}':`,
  );
  for (const file of files.sort((a, b) =>
    a.path.localeCompare(b.path, "en-US", { sensitivity: "accent" }),
  )) {
    alog.log(`  ${file.path}`);
  }

  const origin = ZExtensionOrigin.parse({
    type: "githubRepo",
    repoId: tagInfo.repository.id,
    repoName: tagInfo.repository.full_name,
    repoOwnerId: tagInfo.repository.owner.id,
    repoOwnerHandle: tagInfo.repository.owner.login,
    repoOwnerType: tagInfo.repository.owner.type,
    repoUrl: tagInfo.repository.html_url,
    commitSha: commitInfo.sha,
    nodePath: node.path,
    nodeSha: node.sha,
    nodeType: node.type,
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
