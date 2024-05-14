import { getErrorInfo } from "../../common/errors.js";
import { ZGithubCreateEvent } from "../../common/githubTypes.js";
import { githubWebhookValidator } from "../githubClient.js";
import { TwixContext, makeRouter } from "../koaWrapper.js";
import { processGist } from "./processGist.js";
import { processRepoUrl } from "./processRepoUrl.js";
import { ZDirectoryWebhookParams, processTagEvent } from "./processTagEvent.js";
import { ZSubmitUrlPayload } from "./urlPayload.js";

export const router = makeRouter();

async function processAsync(willProcessAsync: boolean, ctx: TwixContext) {
  if (willProcessAsync) {
    ctx.status = 202;
    ctx.alog.log(
      `Processing continues asynchronously; check remote log for results`,
    );
  } else {
    ctx.alog.log(`Processing completed synchronously`);
    ctx.status = 200;
  }
}

router.post("/webhooks/ghurl", async (ctx) => {
  try {
    const payload = ZSubmitUrlPayload.parse(ctx.request.body);
    if (payload.url.startsWith("https://gist.github.com/")) {
      processAsync(await processGist(payload, ctx.alog), ctx);
    } else if (payload.url.startsWith("https://github.com/")) {
      processAsync(await processRepoUrl(payload, ctx.alog), ctx);
    } else {
      ctx.alog.log("Unsupported URL:", payload.url);
      ctx.status = 400;
    }
  } catch (err) {
    const info = getErrorInfo(err);
    ctx.alog.log(`** Aborting due to error:\n[${info.type}] ${info.message}`);
    ctx.status = info.status;
  } finally {
    ctx.body = ctx.alog.getString();
  }
});

const GH_HOOK_PATH = "/webhooks/gh";
router
  .post(GH_HOOK_PATH, githubWebhookValidator("create"))
  .post(GH_HOOK_PATH, async (ctx) => {
    try {
      const params = ZDirectoryWebhookParams.safeParse(ctx.request.query);
      if (!params.success) {
        ctx.alog.log("Invalid query parameters:", ctx.request.query);
        throw params.error;
      }
      const parsedBody = ZGithubCreateEvent.safeParse(ctx.request.body);
      if (!parsedBody.success) {
        ctx.alog.log("Invalid GitHub webhook body:", ctx.request.body);
        throw parsedBody.error;
      }
      ctx.alog.log("Parsed GitHub payload:", parsedBody.data);
      if (parsedBody.data.ref_type === "tag") {
        processAsync(
          await processTagEvent(parsedBody.data, params.data, ctx.alog),
          ctx,
        );
      } else {
        ctx.alog.log(`Ignoring ref type: ${parsedBody.data.ref_type}`);
        ctx.status = 200;
      }
    } catch (err) {
      const info = getErrorInfo(err);
      ctx.alog.log(`** Aborting due to error:\n[${info.type}] ${info.message}`);
      ctx.status = info.status;
    } finally {
      ctx.body = ctx.alog.getString();
    }
  });
