import { z } from "zod";
import { ZSaneString } from "../../common/saneSchemas.js";
import { ActivityLog } from "../activityLog.js";
import { restClient as gh } from "../githubClient.js";
import { log } from "../../common/log.js";
import { ZGithubGist, ZGithubUser } from "../../common/githubTypes.js";
import {
  ZExtensionOriginGithubGist,
  githubAuthorInfoFromUser,
} from "../../common/extensionSchemas.js";
import {
  PackageFile,
  existingExtensions,
  submitPackage,
} from "./submitPackage.js";
import { gitHash } from "../../common/blobSchemas.js";

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

  // check if database already has this commit
  const commit = gist.history[0];
  const existing = await existingExtensions("origin.commitSha", [
    commit.version,
  ]);
  if (existing.has(commit.version)) {
    alog.log(`Gist commit ${commit.version} is already in the database`);
    return false;
  }

  // fetch user info
  const userResponse = await gh().get(`/users/${commit.user.login}`);
  const user = ZGithubUser.parse(userResponse.data);

  // create author object
  const author = githubAuthorInfoFromUser(user);
  alog.log("Author:", author);

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
  alog.log("Origin:", origin);

  // build file list
  const packageFiles: PackageFile[] = [];
  for (const [_, file] of Object.entries(gist.files)) {
    const contentBuffer = Buffer.from(file.content, "utf-8");
    if (contentBuffer.length !== file.size) {
      throw new Error(`Content length mismatch`);
    }
    packageFiles.push({
      type: "gitSha256File",
      path: file.filename,
      size: file.size,
      hash: gitHash(contentBuffer, "sha256").toString("hex"),
      content: contentBuffer,
    });
  }

  // submit package
  await submitPackage(origin, author, null, packageFiles, gistId, alog);
  return false;
}
