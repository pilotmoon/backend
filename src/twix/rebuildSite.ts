import { z } from "zod";
import { ApiError, getErrorInfo } from "../common/errors.js";
import { NonNegativeSafeInteger, ZSaneDate } from "../common/saneSchemas.js";
import { log } from "../common/log.js";
import { restClient as gh } from "./githubClient.js";
import { hours, seconds } from "../common/timeIntervals.js";
import { getRolo } from "./rolo.js";
import { EXTENSION_SUBMITTER_AUTH_KIND } from "./directory/submitPackage.js";
import { createHash } from "node:crypto";

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

let hourlyTimer: NodeJS.Timeout;
let frequentTimer: NodeJS.Timeout;
export function init() {
  log("init rebuildSite");
  hourlyTimer = setInterval(rebuildSite, hours(1));
  frequentTimer = setInterval(rebuildIfNecessary, seconds(30));
  rebuildIfNecessary();
}
export function shutdown() {
  log("shutdown rebuildSite");
  clearInterval(hourlyTimer);
  clearInterval(frequentTimer);
}

let lastHash: null | string = null;
async function rebuildIfNecessary() {
  try {
    // get recent published extensions, as string not json
    const { data } = await getRolo(EXTENSION_SUBMITTER_AUTH_KIND).get(
      "extensions",
      {
        params: {
          format: "json", // note this is run through stableStringify
          limit: 50,
          published: true,
          extract: "_id",
        },
        responseType: "text",
      },
    );
    const hash = createHash("sha256").update(data).digest("hex");

    if (!lastHash) {
      log("recording initial hash for popclipweb");
      lastHash = hash;
      return;
    }

    if (lastHash === hash) {
      // log("no need to rebuild popclipweb");
      lastHash = hash;
      return;
    }

    log("rebuilding popclipweb because extensions have changed");
    let result = await rebuildSite();
    log(result);

    if (result?.status === 200) {
      lastHash = hash;
    } else {
      log("rebuild failed, will retry");
    }
  } catch (e) {
    let info = getErrorInfo(e);
    log(info);
  }
}

export async function rebuildSite() {
  log("rebuilding popclipweb");
  try {
    const response = await gh().get(
      "/repos/pilotmoon/popclipweb/actions/workflows/75936243/runs",
    );
    const info = ZGithubWorkflowRun.parse(response.data);
    const inProgess = info.workflow_runs.find(
      // in_progress, queued, waiting, pending, or requested
      (run) =>
        ["in_progress", "queued", "waiting", "pending", "requested"].includes(
          run.status,
        ),
    );
    if (inProgess) {
      return {
        status: 409, // Conflict
        message: `A build is already active (${inProgess.status}): ${inProgess.html_url}`,
      };
    }
    const lastGood = info.workflow_runs.find(
      (run) => run.conclusion === "success" && run.status === "completed",
    );
    if (!lastGood) {
      return {
        status: 500,
        message: "No successful builds found",
      };
    }
    const response2 = await gh().post(
      `/repos/pilotmoon/popclipweb/actions/runs/${lastGood.id}/rerun`,
    );
    if (response2.status !== 201) {
      return {
        status: 500,
        message: `Failed to re-run build: ${response2.status}`,
      };
    }
    return {
      status: 200,
      message: `Re-running last successful build: ${lastGood.html_url}`,
    };
  } catch (e) {
    let info = getErrorInfo(e);
    return {
      status: 500,
      message: `Failed to rebuild site: [${info.type}] ${info.message}`,
    };
  }
}
