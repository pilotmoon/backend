import Router from "@koa/router";
import { loadStaticConfig, validateStaticConfig } from "@pilotmoon/fudge";
import picomatch, { type Matcher } from "picomatch";
import { z } from "zod";
import { ApiError, getErrorInfo } from "../../common/errors.js";
import { ActivityLog } from "../activityLog.js";
import { restClient as gh, validateGithubWebhook } from "../github.js";
import { type FileList } from "../../common/fileList.js";

export const router = new Router();

// the webhook payload for a tag creation
const ZGithubTagCreateEvent = z.object({
  ref_type: z.literal("tag"),
  ref: z.string(),
  master_branch: z.string(),
  repository: z.object({
    html_url: z.string(),
    id: z.number(),
    node_id: z.string(),
    name: z.string(),
    private: z.boolean(),
    full_name: z.string(),
    owner: z.object({
      login: z.string(),
      id: z.number(),
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

// object({
//   path: z.string(),
//   mode: z.enum(["100644", "100755", "040000", "160000", "120000"]),
//   type: z.enum(["blob", "tree", "commit"]),
//   sha: z.string().length(40),
//   size: z.number().int().nonnegative().optional(),
//   url: z.string(),
// });

const GH_HOOK_PATH = "/webhooks/gh";
//const ROLO_ROOT = "https://api.pilotmoon.com/v2"
//const ROLO_AUTH_KIND = "live";
const ROLO_ROOT = "http://localhost:1234";
const ROLO_AUTH_KIND = "test";
router
  .post(GH_HOOK_PATH, validateGithubWebhook)
  .post(GH_HOOK_PATH, async (ctx) => {
    const alog = new ActivityLog(ROLO_AUTH_KIND);
    const logUrl = await alog.prepareRemote();
    if (logUrl) {
      alog.log(`Remote log: ${ROLO_ROOT}${logUrl}&format=text`);
    } else {
      alog.log("Failed to create remote log");
    }
    alog.log("GitHub webhook received");
    try {
      const params = ZWebhookParams.safeParse(ctx.request.query);
      if (!params.success) {
        alog.log(`Invalid query parameters: ${pr(ctx.request.query)}`);
        throw params.error;
      }

      const parsedBody = ZGithubPayload.safeParse(ctx.request.body);
      if (!parsedBody.success) {
        alog.log(`Invalid webhook body: ${pr(ctx.request.body)}`);
        throw parsedBody.error;
      }
      alog.log(`Parsed payload: ${pr(parsedBody.data)}`);
      if (parsedBody.data.ref_type === "tag") {
        await processTag(parsedBody.data, params.data, alog);
        ctx.status = 202;
      } else {
        alog.log(`Ignoring ref type: ${parsedBody.data.ref_type}`);
        ctx.status = 200;
      }
    } catch (err) {
      const info = getErrorInfo(err);
      alog.log(`** Aborting due to error:\n[${info.type}] ${info.message}`);
      ctx.status = info.status;
    } finally {
      ctx.body = alog.getString();
    }
  });

function pr(obj: any) {
  try {
    return JSON.stringify(obj, undefined, 2);
  } catch (err) {
    return "**stringify error**";
  }
}

function delay(t: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  });
}

async function processTag(
  tagInfo: z.infer<typeof ZGithubTagCreateEvent>,
  params: z.infer<typeof ZWebhookParams>,
  alog: ActivityLog,
) {
  alog.log(`Parsed URL params: ${pr(params)}`);
  alog.log(`Repo: ${tagInfo.repository.full_name}`);
  alog.log(`Tag: ${tagInfo.ref}`);

  // make sure the repo is public
  if (tagInfo.repository.private) {
    throw new ApiError(400, "The repo must be public");
  }

  // const { data: datac } = await gh().get(
  //   `/repos/${tagInfo.repository.full_name}/contents/`,
  // );
  //log("contents", datac);

  // get the tree for the tag
  const { data } = await gh().get(
    `/repos/${tagInfo.repository.full_name}/git/trees/${tagInfo.ref}`,
    { params: { recursive: 1 } },
  );

  // validate the tree
  const tree = z.array(ZGithubTreeNode).safeParse(data.tree);
  if (!tree.success) {
    alog.log(`Invalid tree data: ${pr(data.tree)}`);
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
  await Promise.all(
    matchingNodes.map(async (node) => {
      try {
        alog.log(`Processing node: ${node.path}`);
        await processNode(tagInfo, tree.data, node, alog);
      } catch (err) {
        alog.log(
          `Error processing node ${node.path}: ${
            err instanceof Error ? err.message : "unknown error"
          }`,
        );
      }
    }),
  );

  alog.log("Done");
  await delay(0);
}

const FILE_MAX_SIZE = 1024 * 1024 * 1;
const TOTAL_MAX_SIZE = 1024 * 1024 * 2;

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

  const packageName = rootNode.path.split("/").at(-1)!;

  // filter tree to just the node's children that are not trees
  // and filter out files with prefix . or _ (hidden files)
  // and files with extension .mp4 and .gif
  const nodeMatcher = picomatch(`${rootNode.path}/**`);
  const extensionMatcher = picomatch(["**/*.mp4", "**/*.gif"]);
  const filteredChildren = tree.filter((entry) => {
    // remove rootNode.path from start of entry.path
    const relativePath = entry.path.slice(rootNode.path.length + 1);
    // split path by / and check if any part of the path starts with . or _
    const parts = relativePath.split("/");
    const hidden = parts.some(
      (part) => part.startsWith(".") || part.startsWith("_"),
    );
    return (
      entry.type !== "tree" &&
      !hidden &&
      nodeMatcher(entry.path) &&
      !extensionMatcher(entry.path)
    );
  });

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
          errors.push(`File too large: ${child.path}`);
        }
      }
    }
  }
  if (totalSize > TOTAL_MAX_SIZE) {
    errors.push(`Total size exceeds limit: ${totalSize}`);
  }
  if (errors.length > 0) {
    throw new ApiError(400, errors.join("\n"));
  }

  // identify all files names `Config` or `Config.*` in the root
  const configMatcher = picomatch(`${rootNode.path}/{Config,Config.*}`);
  const configFiles = filteredChildren.filter((entry) =>
    configMatcher(entry.path),
  );
  if (configFiles.length === 0) {
    alog.log(`No config files found in ${rootNode.path}`);
    return;
  }

  // get the contents of a file from the GitHub API
  const fileList: FileList = [];
  async function getFile(node: z.infer<typeof ZGithubTreeNode>) {
    const { data } = await gh().get(
      `/repos/${tagInfo.repository.full_name}/git/blobs/${node.sha}`,
    );
    const contentsBuffer = Buffer.from(data.content, "base64");
    // remove the node path from the file path
    const name = node.path.slice(rootNode.path.length + 1);
    fileList.push({ name, contentsBuffer });
    //alog.log(`Received file ${name}: ${contentsBuffer.length} bytes`);
  }

  // get the contents of each config file
  await Promise.all(configFiles.map(getFile));

  alog.log(
    `Package ${rootNode.path}: received ${fileList.length} config files:`,
  );
  for (const config of fileList) {
    alog.log(`  ${config.name}: ${config.contentsBuffer.length} bytes`);
  }

  // validate the config files
  const validatedConfig = validateStaticConfig(
    loadStaticConfig(
      fileList.map(({ name, contentsBuffer }) => {
        return { name, contents: contentsBuffer.toString() };
      }),
    ),
  );
  alog.log(`Validated config: ${pr(validatedConfig)}`);
  // TODO: perform further validation on the config

  // now add the remaining file contents to the fileList
  const remainingFiles = filteredChildren.filter(
    (entry) => !configMatcher(entry.path),
  );
  await Promise.all(remainingFiles.map(getFile));

  // now we have all the files we need to process the package
  // calculate the digest
  //const digest = calculateDigest(fileList, packageName);
  //alog.log(`Calculated digest for ${packageName}: ${digest.toString("hex")}`);
}
