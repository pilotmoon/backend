import Router from "@koa/router";
import { z } from "zod";
import { restClient as gh, validateGithubWebhook } from "../github.js";
import picomatch, { type Matcher } from "picomatch";
import { ActivityLog } from "../activityLog.js";
import { ApiError, getErrorInfo } from "../../common/errors.js";

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
const ZGithubTreeNode = z.object({
  path: z.string(),
  mode: z.enum(["100644", "100755", "040000", "160000", "120000"]),
  type: z.enum(["blob", "tree", "commit"]),
  sha: z.string().length(40),
  size: z.number().int().nonnegative().optional(),
  url: z.string(),
});

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
  Promise.all(matchingNodes.map((node) => processNode(node, alog)));

  alog.log("Done");
  await delay(0);
}

async function processNode(
  node: z.infer<typeof ZGithubTreeNode>,
  alog: ActivityLog,
) {
  alog.log(`Processing node: ${node.path}`);
  if (node.type !== "tree") {
    alog.log(`Skipping non-tree node: ${node.type}`);
    return;
  }
}
