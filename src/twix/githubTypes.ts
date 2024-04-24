import { z } from "zod";
import { ZSaneDate, ZSaneEmail, ZSaneString } from "../common/saneSchemas.js";

/************************
  GitHub Webhook Events
*************************/

export const ZGithubTagCreateEvent = z.object({
  ref_type: z.literal("tag"),
  ref: z.string(),
  repository: z.object({
    html_url: z.string(),
    id: z.number().int().safe().nonnegative(),
    name: z.string(),
    private: z.boolean(),
    full_name: z.string(),
    owner: z.object({
      login: z.string(),
      id: z.number().int().safe().nonnegative(),
      type: z.enum(["User", "Organization"]),
    }),
  }),
});
export type GithubTagCreateEvent = z.infer<typeof ZGithubTagCreateEvent>;

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
export const ZGithubCreateEvent = z.discriminatedUnion("ref_type", [
  ZGithubTagCreateEvent,
  ZGithubBranchCreateEvent,
  ZGithubRepoCreateEvent,
]);

/**************
  GitHub Tree
***************/

const ZGitHubBaseNode = z.object({
  path: z.string(),
  sha: z.string(),
});

export const ZGithubBlobNode = ZGitHubBaseNode.extend({
  type: z.literal("blob"),
  mode: z.enum(["100644", "100755", "120000"]),
  size: z.number().int().nonnegative(),
});
export type GithubBlobNode = z.infer<typeof ZGithubBlobNode>;

const ZGithubTreeNode = ZGitHubBaseNode.extend({
  type: z.literal("tree"),
  mode: z.enum(["040000"]),
});

const ZGithubCommitNode = ZGitHubBaseNode.extend({
  type: z.literal("commit"),
  mode: z.enum(["160000"]),
});

export const ZGithubNode = z.discriminatedUnion("type", [
  ZGithubBlobNode,
  ZGithubTreeNode,
  ZGithubCommitNode,
]);
export type GithubNode = z.infer<typeof ZGithubNode>;

export const ZGithubTree = z.object({
  sha: z.string(),
  tree: z.array(ZGithubNode),
  truncated: z.boolean(),
});

export const ZGithubBlob = z.object({
  content: z.string(),
  encoding: z.literal("base64"),
  sha: z.string(),
  size: z.number().int().nonnegative(),
});

/*********************
  Other GitHub Types
**********************/

export const ZGithubRefObject = z.object({
  ref: z.string(),
  object: z.object({
    type: z.literal("commit"),
    sha: z.string(),
  }),
});

export const ZGithubCommitObject = z.object({
  sha: z.string(),
  committer: z.object({
    name: ZSaneString,
    email: ZSaneEmail,
    date: ZSaneDate,
  }),
});
export type GithubCommitObject = z.infer<typeof ZGithubCommitObject>;
