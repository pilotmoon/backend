import { z } from "zod";
import { ZSaneString } from "../../common/saneSchemas.js";
import { ActivityLog } from "../activityLog.js";
import { restClient as gh } from "../githubClient.js";
import { log } from "../../common/log.js";
import { ZGithubGist, ZGithubUser } from "../../common/githubTypes.js";
import { ZExtensionOriginGithubGist } from "../../common/extensionSchemas.js";

export const ZSubmitGistPayload = z.object({
  url: ZSaneString,
});
export type SubmitGistPayload = z.infer<typeof ZSubmitGistPayload>;

export async function processGist(
  payload: SubmitGistPayload,
  alog: ActivityLog,
) {
  alog.log(`Processing gist: ${payload.url}`);

  // extract gist id from url
  const match = /^https:\/\/gist.github.com\/[^/]+\/([a-f0-9]+)$/.exec(
    payload.url,
  );
  if (!match) {
    throw new Error(`Invalid gist URL: ${payload.url}`);
  }

  // fetch gist from github api: /gists/{gist_id}
  const gistId = match[1];
  alog.log(`Fetching gist ${gistId} from GitHub API`);
  const response = await gh().get(`/gists/${gistId}`);
  log(`Response:`, response.data);
  const gist = ZGithubGist.parse(response.data);
  log(`Response:`, gist);

  // check the gist is public
  if (!gist.public) {
    throw new Error(`Gist is not public`);
  }

  // check the gist is not truncated
  if (gist.truncated) {
    throw new Error(`Response is truncated`);
  }

  // get commit and author info
  const version = gist.history.length;
  const commit = gist.history[0];
  const userResponse = await gh().get(`/users/${commit.user.login}`);
  log("user", userResponse.data);
  const user = ZGithubUser.parse(userResponse.data);

  // construct origin object
  const origin = ZExtensionOriginGithubGist.parse({
    type: "githubGist",
    gistId,
    gistOwnerId: user.id,
    gistOwnerHandle: user.login,
    gistOwnerType: user.type,
    gistUrl: gist.html_url,
    commitSha: commit.version,
    commitDate: commit.committed_at,
  });
  alog.log("Gist info:", {
    version,
    origin,
  });

  // build file list

  return false;
}
