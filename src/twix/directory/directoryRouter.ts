import { AxiosError } from "axios";
import { z } from "zod";
import { githubWebhookValidator } from "../github.js";
import { makeRouter } from "../koaWrapper.js";

import {
  ZGithubTagCreateEvent,
  ZWebhookParams,
  processTag,
} from "./directorySubmitter.js";
import { getErrorInfo } from "../../common/errors.js";

export const router = makeRouter();

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
