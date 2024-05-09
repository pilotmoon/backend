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

const ZEventCommon = z.object({
  timestamp: ZSaneDate,
  logUrl: ZSaneString.nullable(),
  ownerId: NonNegativeSafeInteger,
  ownerHandle: ZSaneString,
  submissions: z.array(ZSubmissionResult),
});

const ZRepoTagEvent = ZEventCommon.extend({
  type: z.literal("githubRepoTag"),
  repoId: NonNegativeSafeInteger,
  repoName: ZSaneString,
  repoTag: ZSaneString,
});
export type RepoTagEvent = z.infer<typeof ZRepoTagEvent>;

const ZGistEvent = ZEventCommon.extend({
  type: z.literal("githubGistSubmit"),
  gistId: ZSaneString,
});
export type GistEvent = z.infer<typeof ZGistEvent>;

export const ZEventInfo = z.discriminatedUnion("type", [
  ZRepoTagEvent,
  ZGistEvent,
]);
export type EventInfo = z.infer<typeof ZEventInfo>;

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
