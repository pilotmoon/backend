import { z } from "zod";
import {
  NonNegativeSafeInteger,
  ZSaneDate,
  ZSaneString,
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
    submissions: z.array(ZSubmissionResult),
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

const ZEventExtHookCore = ZEventCore.extend({
  ownerId: NonNegativeSafeInteger,
  ownerHandle: ZSaneString,
  outcome: ZEventHookOutcome,
});

export const ZEvent = z.discriminatedUnion("type", [
  ZEventExtHookCore.extend({
    type: z.literal("githubRepoTag"),
    repoId: NonNegativeSafeInteger,
    repoName: ZSaneString,
    repoTag: ZSaneString,
  }),
  ZEventExtHookCore.extend({
    type: z.literal("githubGistSubmit"),
    gistId: NonNegativeSafeInteger,
  }),
]);
export type Event = z.infer<typeof ZEvent>;
