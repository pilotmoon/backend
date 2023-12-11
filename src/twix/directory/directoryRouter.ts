import Router from "@koa/router";
import { z } from "zod";
import { log } from "../../common/log.js";
import { validateGithubWebhook } from "../github.js";

export const router = new Router();

// the webhook payload for a tag creation
const ZGithubTag = z.object({
  ref_type: z.literal("tag"),
  ref: z.string(),
  master_branch: z.string(),
  repository: z.object({
    html_url: z.string(),
    id: z.number(),
    name: z.string(),
    owner: z.object({
      login: z.string(),
      id: z.number(),
    }),
  }),
});

const GH_HOOK_PATH = "/webhooks/gh";
router
  .post(GH_HOOK_PATH, validateGithubWebhook)
  .post(GH_HOOK_PATH, async (ctx) => {
    // console.log("GOT A WEBHOOK!", ctx.request.body);
    const tagInfo = ZGithubTag.parse(ctx.request.body);
    log("GOT A TAG!", ctx.request.body);
    log("tagInfo", tagInfo);
    ctx.status = 200;
  });
