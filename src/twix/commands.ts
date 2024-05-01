import { makeRouter } from "./koaWrapper.js";
import { restClient as gh } from "./githubClient.js";
import { z } from "zod";
import { NonNegativeSafeInteger, ZSaneDate } from "../common/saneSchemas.js";
import { log } from "../common/log.js";
import { ApiError } from "../common/errors.js";

export const router = makeRouter();

const ZGithubWorkflowRun = z.object({
  total_count: NonNegativeSafeInteger,
  workflow_runs: z.array(
    z.object({
      id: NonNegativeSafeInteger,
      name: z.string(),
      run_number: NonNegativeSafeInteger,
      status: z.string(),
      event: z.string(),
      conclusion: z.string().nullable(),
      html_url: z.string(),
      created_at: ZSaneDate,
    }),
  ),
});

router.get("/webhooks/rebuildSite2f997c6", async (ctx) => {
  //https://api.github.com/repos/pilotmoon/popclipweb/actions/workflows/75936243/runs

  const response = await gh().get(
    "/repos/pilotmoon/popclipweb/actions/workflows/75936243/runs",
  );
  const info = ZGithubWorkflowRun.parse(response.data);
  log("recent runs", info.workflow_runs.slice(0, 5));
  const inProgess = info.workflow_runs.find(
    // in_progress, queued, waiting, pending, or requested
    (run) =>
      ["in_progress", "queued", "waiting", "pending", "requested"].includes(
        run.status,
      ),
  );
  if (inProgess) {
    throw new ApiError(
      409,
      `A build is already active (${inProgess.status}): ${inProgess.html_url}`,
    );
  }
  const lastGood = info.workflow_runs.find(
    (run) => run.conclusion === "success" && run.status === "completed",
  );
  if (!lastGood) {
    throw new Error("No successful builds found");
  }
  const response2 = await gh().post(
    `/repos/pilotmoon/popclipweb/actions/runs/${lastGood.id}/rerun`,
  );
  if (response2.status !== 201) {
    throw new ApiError(500, `Failed to re-run build: ${response2.status}`);
  }
  ctx.body = `Re-running last successful build: ${lastGood.html_url}`;
});
