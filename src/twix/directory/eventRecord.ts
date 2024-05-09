import { z } from "zod";
import {
  NonNegativeSafeInteger,
  ZSaneDate,
  ZSaneString,
  extractDefaultString,
} from "../../common/saneSchemas.js";
import { ZVersionString } from "../../common/versionString.js";
import {
  ZExtensionInfo,
  ZExtensionOrigin,
} from "../../common/extensionSchemas.js";
import { ZProblemDetails } from "../../common/errors.js";

const ZSubmissionResultCore = z.object({
  origin: ZExtensionOrigin,
});

export const ZSubmissionResult = z.discriminatedUnion("status", [
  ZSubmissionResultCore.extend({
    status: z.literal("ok"),
    id: z.string(),
    shortcode: z.string(),
    version: ZVersionString,
    info: ZExtensionInfo,
  }),
  ZSubmissionResultCore.extend({
    status: z.literal("error"),
    details: ZProblemDetails,
  }),
]);
export type SubmissionResult = z.infer<typeof ZSubmissionResult>;

export const ZEventHookOutcome = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    results: z.array(ZSubmissionResult),
  }),
  z.object({
    status: z.literal("error"),
    details: ZProblemDetails,
  }),
]);

const ZEventCore = z.object({
  timestamp: ZSaneDate,
  logUrl: ZSaneString.nullable(),
});

const ZEventFailure = ZEventCore.extend({
  type: z.literal("hookFailure"),
  details: ZProblemDetails,
});
export type EventFailure = z.infer<typeof ZEventFailure>;

const ZEventExtHookCore = ZEventCore.extend({
  ownerId: NonNegativeSafeInteger,
  ownerHandle: ZSaneString,
  outcome: ZEventHookOutcome,
});

const ZRepoTagEvent = ZEventExtHookCore.extend({
  type: z.literal("githubRepoTag"),
  repoId: NonNegativeSafeInteger,
  repoName: ZSaneString,
  repoTag: ZSaneString,
});
export type RepoTagEvent = z.infer<typeof ZRepoTagEvent>;

const ZGistEvent = ZEventExtHookCore.extend({
  type: z.literal("githubGistSubmit"),
  gistId: NonNegativeSafeInteger,
});
export type GistEvent = z.infer<typeof ZGistEvent>;

export const ZEventRecord = z.discriminatedUnion("type", [
  ZRepoTagEvent,
  ZGistEvent,
  ZEventFailure,
]);
export type EventRecord = z.infer<typeof ZEventRecord>;

export function describeResult(r: SubmissionResult) {
  if (r.origin.type === "githubRepo") {
    if (r.status === "ok") {
      return `✅ ${r.origin.nodePath.black.bgWhite}\n${extractDefaultString(
        r.info.name,
      )}\n${r.shortcode} ${r.version} ${r.info.identifier}\n`;
    } else {
      return `🚫 ${r.origin.nodePath.black.bgWhite}\n${r.details.title}\n${r.details.detail}\n`;
    }
  } else if (r.origin.type === "githubGist") {
    if (r.status === "ok") {
      return `✅ ${r.origin.gistId.black.bgWhite}\n${extractDefaultString(
        r.info.name,
      )}\n${r.shortcode} ${r.version} ${r.info.identifier}\n`;
    } else {
      return `🚫 ${r.origin.gistId.black.bgWhite}\n${r.details.title}\n${r.details.detail}\n`;
    }
  }
  return `<unknown origin>`;
}

export function describeResultArray(results: SubmissionResult[]) {
  let message = "";
  let okResults = results.filter((r) => r.status === "ok");
  let errorResults = results.filter((r) => r.status === "error");
  message += `There were ${okResults.length} successful submissions and ${errorResults.length} failed submissions.\n`;
  message += `\nSuccessful submissions:\n\n${okResults
    .map(describeResult)
    .join("\n")}`;
  message += `\nFailed submissions:\n\n${errorResults
    .map(describeResult)
    .join("\n")}`;
  return message;
}
