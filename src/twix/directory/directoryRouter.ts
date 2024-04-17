import { loadStaticConfig, validateStaticConfig } from "@pilotmoon/fudge";
import { AxiosError } from "axios";
import pLimit from "p-limit";
import picomatch from "picomatch";
import { z } from "zod";
import { ZBlobHash } from "../../common/blobSchemas.js";
import { ApiError, getErrorInfo } from "../../common/errors.js";
import { ZSaneIdentifier } from "../../common/saneSchemas.js";
import { sleep } from "../../common/sleep.js";
import { ActivityLog } from "../activityLog.js";
import { restClient as gh, githubWebhookValidator } from "../github.js";
import { makeRouter } from "../koaWrapper.js";
import { getRolo } from "../rolo.js";
import { nextTick } from "node:process";
import { BlobFileList } from "../../common/fileList.js";

export const router = makeRouter();

// the webhook payload for a tag creation
const ZGithubTagCreateEvent = z.object({
  ref_type: z.literal("tag"),
  ref: z.string(),
  master_branch: z.string(),
  repository: z.object({
    html_url: z.string(),
    id: z.number().int().safe().nonnegative(),
    node_id: z.string(),
    name: z.string(),
    private: z.boolean(),
    full_name: z.string(),
    owner: z.object({
      login: z.string(),
      id: z.number().int().safe().nonnegative(),
      node_id: z.string(),
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
  include: ZGlobPatternArray,
  exclude: ZGlobPatternArray.optional(),
  tagPrefix: ZSaneIdentifier.optional(),
});

const ZGithubTreeNode = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("blob"),
    path: z.string(),
    mode: z.enum(["100644", "100755", "120000"]),
    sha: z.string(),
    size: z.number().int().nonnegative(),
    url: z.string(),
  }),
  z.object({
    type: z.literal("tree"),
    path: z.string(),
    mode: z.enum(["040000"]),
    sha: z.string(),
    url: z.string(),
  }),
  z.object({
    type: z.literal("commit"),
    path: z.string(),
    mode: z.enum(["160000"]),
    sha: z.string(),
    url: z.string(),
  }),
]);

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
        await processTag(parsedBody.data, params.data, ctx.alog);
        ctx.status = 202;
      } else {
        ctx.alog.log(`Ignoring ref type: ${parsedBody.data.ref_type}`);
        ctx.status = 200;
      }
      ctx.alog.log(
        `Processing continues asynchronously; check remote log for results`,
      );
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
) {
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
  const tree = z.array(ZGithubTreeNode).safeParse(data.tree);
  if (!tree.success) {
    alog.log("Invalid tree data:", data.tree);
    throw tree.error;
  }
  alog.log(`Received tree with ${tree.data.length} entries`);

  // generate matchers
  const includers = params.include.map((pattern) => picomatch(pattern));
  const excluders = params.exclude?.map((pattern) => picomatch(pattern)) ?? [];

  // filter the tree
  const matchingNodes = tree.data.filter(
    (entry) =>
      includers.some((match) => match(entry.path)) &&
      !excluders.some((match) => match(entry.path)),
  );

  const MAX_PATHS = 200;
  if (matchingNodes.length > MAX_PATHS) {
    throw new ApiError(
      400,
      `Too many paths (matched ${matchingNodes.length}, maximum ${MAX_PATHS})`,
    );
  } else if (matchingNodes.length === 0) {
    throw new ApiError(
      400,
      "No paths match include/exclude rules, nothing to do",
    );
  }
  alog.log(`Matched ${matchingNodes.length} paths`);

  // TODO: here we would screen out matching nodes that are already
  // in the database, and only process the new ones. For now, we'll
  // just process everything.

  nextTick(async () => {
    const limit = pLimit(10);
    const errors: string[] = [];
    await Promise.all(
      matchingNodes.map((node) =>
        limit(async (node) => {
          try {
            await processNode(tagInfo, tree.data, node, alog);
          } catch (err) {
            const info = getErrorInfo(err);
            errors.push(
              `* Path ${node.path}:\n[${info.type}]\n${info.message}`,
            );
            alog.log(
              `Error processing node ${node.path}:\n[${info.type}]\n${info.message}`,
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
}

const FILE_MAX_SIZE = 1024 * 1024 * 1;
const TOTAL_MAX_SIZE = 1024 * 1024 * 2;
const MAX_FILE_COUNT = 100;
async function processNode(
  tagInfo: z.infer<typeof ZGithubTagCreateEvent>,
  tree: z.infer<typeof ZGithubTreeNode>[],
  rootNode: z.infer<typeof ZGithubTreeNode>,
  alog: ActivityLog,
) {
  alog.log(`Processing node: ${rootNode.path}`);
  if (rootNode.type !== "tree") {
    alog.log(`Skipping non-tree node: ${rootNode.type}`);
    return;
  }
  if (rootNode.path.length === 0) {
    alog.log("Skipping root node");
    return;
  }

  // filter tree to just the node's children that are not trees
  // and filter out files and directories with prefix . or _ (hidden files)
  const nodeMatcher = picomatch(`${rootNode.path}/**`);
  const filteredChildren = tree.filter((entry) => {
    // remove rootNode.path from start of entry.path
    const relativePath = entry.path.slice(rootNode.path.length + 1);
    // split path by / and check if any part of the path starts with . or _
    const parts = relativePath.split("/");
    const hidden = parts.some(
      (part) => part.startsWith(".") || part.startsWith("_"),
    );
    return entry.type !== "tree" && !hidden && nodeMatcher(entry.path);
  });

  // if no children, return
  if (filteredChildren.length === 0) {
    throw new ApiError(400, "No non-hidden files found in tree");
  }
  // if too many children, return
  if (filteredChildren.length > MAX_FILE_COUNT) {
    throw new ApiError(400, "Too many files in tree");
  }

  // now make sure that:
  // - tree contains no symlinks
  // - tree contains no submodules
  // - no individual file exceeds FILE_MAX_SIZE
  // - total size of all files does not exceed TOTAL_MAX_SIZE
  // - no duplicate file names under case insensitive comparison
  const errors: string[] = [];
  const seenFiles = new Set<string>();
  let totalSize = 0;
  for (const child of filteredChildren) {
    if (seenFiles.has(child.path.toLowerCase())) {
      errors.push(`Duplicate file name: ${child.path}`);
    }
    if (child.type === "commit") {
      errors.push(`Submodule found: ${child.path}`);
    } else if (child.type === "blob") {
      if (child.mode === "120000") {
        errors.push(`Symlink found: ${child.path}`);
      } else {
        totalSize += child.size;
        if (child.size > FILE_MAX_SIZE) {
          errors.push(
            `File too large: ${child.path} (${child.size}; limit ${FILE_MAX_SIZE})`,
          );
        }
      }
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
  const AUTH_KIND = "test";
  const { data } = await getRolo(AUTH_KIND).get("blobs", {
    params: {
      hash: filteredChildren.map((child) => child.sha).join(","),
      format: "json",
      extract: "hash",
      limit: filteredChildren.length,
    },
  });
  const gotHashes = new Set(z.array(ZBlobHash).parse(data));

  // upload any that are not already in the blob store
  const fileList: BlobFileList = [];
  async function getFile(node: z.infer<typeof ZGithubTreeNode>) {
    if (node.type !== "blob") {
      throw new Error("Invalid node type");
    }
    if (gotHashes.has(node.sha)) {
      alog.log(`Skipping existing blob: ${node.path}`);
    } else {
      alog.log(`Downloading blob from GitHub: ${node.path}`);
      const ghResponse = await gh().get(
        `/repos/${tagInfo.repository.full_name}/git/blobs/${node.sha}`,
      );
      const ghBlob = ZGithubBlob.parse(ghResponse.data);
      if (ghBlob.sha !== node.sha) {
        throw new Error("GitHub hash mismatch");
      }
      alog.log(
        `Uploading blob to database: ${node.path} ${ghBlob.size} bytes ${ghBlob.sha}`,
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
    fileList.push({
      path: node.path.slice(rootNode.path.length + 1),
      hash: node.sha,
      exec: node.mode === "100755",
    });
  }

  // build the file list
  const limit = pLimit(5);
  await Promise.all(filteredChildren.map((node) => limit(getFile, node)));

  // print something
  alog.log(`Gathered ${fileList.length} files for tree '${rootNode.path}:`);
  for (const file of fileList.sort((a, b) =>
    a.path.localeCompare(b.path, "en-US", { sensitivity: "accent" }),
  )) {
    alog.log(`  ${file.path}`);
  }

  // now we have all the files we need to submit the package

  // TODO:
  // - parse the version from the tag name
  // - compile the origin info
}
