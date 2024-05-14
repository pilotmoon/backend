import { z } from "zod";
import {
  NonNegativeSafeInteger,
  ZSaneDate,
  ZSaneString,
  extractDefaultString,
} from "./saneSchemas.js";
import { ZVersionString } from "./versionString.js";
import {
  ExtensionOrigin,
  ExtensionOriginGithubRepo,
  ExtensionPatch,
  ZExtensionInfo,
  ZExtensionOrigin,
} from "./extensionSchemas.js";
import { ZProblemDetails } from "./errors.js";

const ZReviewStatus = z.enum(["pending", "published", "rejected"]);

export const ZSubmissionResult = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    origin: ZExtensionOrigin,
    id: z.string(),
    shortcode: z.string(),
    version: ZVersionString,
    info: ZExtensionInfo,
    reviewStatus: ZReviewStatus,
    reviewComments: z.string().nullable(),
  }),
  z.object({
    status: z.literal("error"),
    origin: ZExtensionOrigin.nullable(),
    details: ZProblemDetails,
  }),
]);
export type SubmissionResult = z.infer<typeof ZSubmissionResult>;

const ZEventCommon = z.object({
  timestamp: ZSaneDate,
  logUrl: ZSaneString.nullable(),
});

export const ZStatusChangeEvent = ZEventCommon.extend({
  type: z.literal("statusChange"),
  submission: ZSubmissionResult,
});
export type StatusChangeEvent = z.infer<typeof ZStatusChangeEvent>;

const ZRepoEvent = ZEventCommon.extend({
  type: z.literal("githubRepoTag"),
  ownerHandle: ZSaneString,
  repoName: ZSaneString,
  repoTag: ZSaneString.nullable(),
  submissions: z.array(ZSubmissionResult),
});
export type RepoEvent = z.infer<typeof ZRepoEvent>;

const ZGistEvent = ZEventCommon.extend({
  type: z.literal("githubGistSubmit"),
  submission: ZSubmissionResult,
});
export type GistEvent = z.infer<typeof ZGistEvent>;

export const ZEventInfo = z.discriminatedUnion("type", [
  ZRepoEvent,
  ZGistEvent,
  ZStatusChangeEvent,
]);
export type EventInfo = z.infer<typeof ZEventInfo>;

export function reviewStatus(rec: ExtensionPatch) {
  if (rec.published) return "published" as const;
  if (rec.reviewed) return "rejected" as const;
  return "pending" as const;
}

export function describeResult(r: SubmissionResult) {
  if (
    r.origin?.type === "githubRepo" ||
    r.origin?.type === "githubRepoPartial"
  ) {
    if (r.status === "ok") {
      return `✅ ${r.origin.nodePath.black.bgWhite}\n${extractDefaultString(
        r.info.name,
      )}\n${r.shortcode} ${r.version} ${r.info.identifier}\n`;
    } else {
      return `🚫 ${r.origin.nodePath.black.bgWhite}\n${r.details.title}\n${r.details.detail}\n`;
    }
  } else if (r.origin?.type === "githubGist") {
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
