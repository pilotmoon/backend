import Router from "@koa/router";
import { z } from "zod";
import { log } from "../../common/log.js";
import { restClient as gh, validateGithubWebhook } from "../github.js";

export const router = new Router();

// the webhook payload for a tag creation
const ZGithubTag = z.object({
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

const ZWebhookParams = z.object({
  noemail: z.string().optional(),
});

const GH_HOOK_PATH = "/webhooks/gh";
router
  .post(GH_HOOK_PATH, validateGithubWebhook)
  .post(GH_HOOK_PATH, async (ctx) => {
    // console.log("GOT A WEBHOOK!", ctx.request.body);
    const tagInfo = ZGithubTag.parse(ctx.request.body);
    log("query", ctx.request.query);
    const params = ZWebhookParams.parse(ctx.request.query);
    log("GOT A TAG!", ctx.request.body);
    ctx.body = await processTag(tagInfo, params);
    ctx.status = 202;
  });

async function processTag(
  tagInfo: z.infer<typeof ZGithubTag>,
  params: z.infer<typeof ZWebhookParams>,
) {
  log("processTag", tagInfo);
  const messages = [
    `.-=beep boop=-. :: PopClip Extensions Directory :: Webhook Receiver :: ${new Date().toISOString()}`,
    `GitHub webhook received from repo: ${tagInfo.repository.name}/${tagInfo.repository.owner.login}`,
    `- New tag: ${tagInfo.ref}`,
    `- Webhook URL params: ${params}`,
  ];
  if (tagInfo.repository.private) {
    messages.push("This is a private repo -- no action taken");
  }

  const { data } = await gh().get(
    `/repos/${tagInfo.repository.full_name}/git/trees/${tagInfo.ref}`,
    { params: { recursive: 1 } },
  );
  log("tree", data);

  const { data: datac } = await gh().get(
    `/repos/${tagInfo.repository.full_name}/contents/`,
  );
  log("contents", datac);

  return messages.join("\n");
}
