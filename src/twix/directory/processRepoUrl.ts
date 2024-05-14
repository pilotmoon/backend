import { z } from "zod";
import { ZSaneString } from "../../common/saneSchemas.js";
import { ActivityLog } from "../activityLog.js";
import { ApiError } from "../../common/errors.js";
import {
  GithubNode,
  ZGithubCommitObject,
  ZGithubRefObject,
  ZGithubRepo,
  ZGithubTree,
  ZGithubUser,
} from "../../common/githubTypes.js";
import { restClient as gh } from "../githubClient.js";
import {
  EXTENSION_SUBMITTER_AUTH_KIND,
  existingExtensions,
  submitPackage,
} from "./submitPackage.js";
import {
  ZExtensionOriginGithubRepo,
  githubAuthorInfoFromUser,
} from "../../common/extensionSchemas.js";
import { getChangeCommit, getPackageFiles } from "./processTagEvent.js";
import { RepoEvent, describeResultArray } from "../../common/events.js";
import { getRolo } from "../rolo.js";

export const ZSubmitRepoPayload = z.object({
  url: ZSaneString,
});
export type SubmitRepoPayload = z.infer<typeof ZSubmitRepoPayload>;

export async function processRepoUrl(
  payload: SubmitRepoPayload,
  alog: ActivityLog,
): Promise<boolean> {
  alog.log(`Processing repo url: ${payload.url}`);

  // extract owner, repo name, ref and path from url
  // e.g. https://github.com/pilotmoon/example/tree/master/source/example.popclipext/

  const match =
    /^https:\/\/github.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/tree\/(?<ref>[^/]+)\/(?<path>.+)$/.exec(
      payload.url,
    );
  if (!match) {
    throw new ApiError(400, `Invalid GitHub repo URL`);
  }
  let { owner, repo, ref, path } = match.groups as {
    owner: string;
    repo: string;
    ref: string;
    path: string;
  };

  // remove trailing slash
  if (path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  alog.log(`Owner: ${owner}, Repo: ${repo}, Ref: ${ref}, Path: ${path}`);

  // fetch repo info from github api: /repos/{owner}/{repo}
  alog.log(`Fetching repo ${owner}/${repo} from GitHub API`);
  const response = await gh().get(`/repos/${owner}/${repo}`);
  const repoInfo = ZGithubRepo.parse(response.data);
  alog.log({ repoInfo });

  // check the repo is public
  if (repoInfo.private) {
    throw new ApiError(400, `Repo is private`);
  }

  // now fetch the tree for the ref
  alog.log(`Fetching tree for ref ${ref}`);
  const treeResponse = await gh().get(
    `/repos/${owner}/${repo}/git/trees/${ref}`,
    { params: { recursive: 1 } },
  );
  const tree = ZGithubTree.parse(treeResponse.data);
  //alog.log({ tree });
  if (tree.truncated) {
    throw new ApiError(400, "The tree is truncated; repo is too large");
  }

  let node: GithubNode;

  if (path === ".") {
    alog.log("Treating repo root as package directory");
    node = {
      type: "tree",
      path: "",
      mode: "040000",
      sha: tree.sha,
    };
  } else {
    // find the node for the path
    let found = tree.tree.find((n) => n.path === path);
    if (!found) {
      throw new ApiError(400, `Path not found in repo tree`);
    }
    node = found;
  }

  // check which nodes are already processed
  const gotNodeShas = await existingExtensions("origin.nodeSha", [node.sha]);
  if (gotNodeShas.has(node.sha)) {
    alog.log("Node is already in the database");
    return false;
  }
  alog.log(`Processing new node`);

  let commitSha: string;
  // if ref looks like a sha
  if (/^[0-9a-f]{40}$/.test(ref)) {
    alog.log("Ref looks like a sha");
    commitSha = ref;
  } else {
    // get the ref info
    alog.log(`Fetching ref ${ref}`);
    const refResponse = await gh().get(
      `/repos/${owner}/${repo}/git/ref/heads/${ref}`,
    );
    const refInfo = ZGithubRefObject.parse(refResponse.data);
    alog.log({ refInfo });
    commitSha = refInfo.object.sha;
  }

  const commitResponse = await gh().get(
    `/repos/${owner}/${repo}/git/commits/${commitSha}`,
  );
  const commit = ZGithubCommitObject.parse(commitResponse.data);
  alog.log({ commit });

  // fetch user info
  const userResponse = await gh().get(`/users/${owner}`);
  const user = ZGithubUser.parse(userResponse.data);

  // create author object
  const author = githubAuthorInfoFromUser(user);
  alog.log("Author:", author);

  // get changeCommit
  let changeCommit = await getChangeCommit(
    node,
    `${owner}/${repo}`,
    commit.sha,
  );

  let origin = ZExtensionOriginGithubRepo.parse({
    type: "githubRepo",
    repoId: repoInfo.id,
    repoName: repoInfo.name,
    ownerId: repoInfo.owner.id,
    ownerHandle: repoInfo.owner.login,
    nodePath: node.path,
    nodeSha: node.sha,
    nodeType: node.type,
    commitSha: changeCommit.sha,
    commitDate: changeCommit.date,
    commitMessage: changeCommit.message,
  });

  let files = await getPackageFiles(node, tree.tree, `${owner}/${repo}`, alog);
  let result = await submitPackage(
    origin,
    author,
    null,
    files,
    node.path,
    alog,
  );

  alog.log("Repo URL processed");
  alog.log(describeResultArray([result]));
  alog.log("Done");

  let event: RepoEvent = {
    type: "githubRepoTag",
    timestamp: alog.created,
    logUrl: alog.url ?? null,
    ownerHandle: owner,
    repoName: repo,
    repoTag: null,
    submissions: [result],
  };

  await getRolo(EXTENSION_SUBMITTER_AUTH_KIND).post("events", event);
  return false;
}
