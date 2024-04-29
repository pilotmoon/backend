import { z } from "zod";
import {
  ExtensionSubmission,
  ZExtensionSubmission,
  calculateDigest,
} from "../../common/extensionSchemas.js";
import {
  PositiveSafeInteger,
  ZSaneIdentifier,
  ZSaneLongString,
  ZSaneString,
} from "../../common/saneSchemas.js";
import { ApiError } from "../../common/errors.js";
import { Collection } from "mongodb";
import { randomIdentifier } from "../identifiers.js";

export const ZExtensionAppInfo = z.object({
  name: ZSaneString,
  link: ZSaneString,
});

const ZIconComponents = z.object({
  prefix: ZSaneString,
  payload: ZSaneString,
  modifiers: z.record(z.unknown()),
});

export const ZExtensionInfo = z.object({
  name: ZSaneString,
  identifier: ZSaneIdentifier,
  description: ZSaneString.optional(),
  keywords: ZSaneString.optional(),
  icon: ZIconComponents.optional(),
  actionTypes: z.array(ZSaneString).optional(),
  entitlements: z.array(ZSaneString).optional(),
  apps: z.array(ZExtensionAppInfo).optional(),
  macosVersion: ZSaneString.optional(),
  popclipVersion: PositiveSafeInteger.optional(),
});

const ZExtensionCoreRecord = ZExtensionSubmission.extend({
  _id: z.string(),
  object: z.literal("extension"),
  created: z.date(),
});

const ZAcceptedExtensionRecord = ZExtensionCoreRecord.extend({
  shortcode: z.string(),
  info: ZExtensionInfo,
  published: z.boolean().optional(),
});

const ZRejectedExtensionRecord = ZExtensionCoreRecord.extend({
  message: ZSaneLongString,
});

export const ZExtensionRecord = z.discriminatedUnion("status", [
  ZAcceptedExtensionRecord.extend({ status: z.literal("accepted") }),
  ZRejectedExtensionRecord.extend({ status: z.literal("rejected") }),
]);
export type ExtensionRecord = z.infer<typeof ZExtensionRecord>;

export async function processSubmission(
  submission: ExtensionSubmission,
  dbc: Collection<ExtensionRecord>,
): Promise<ExtensionRecord> {
  const errors: string[] = [];

  // check the submitted files digest
  const filesDigest = calculateDigest(submission.files);
  if (filesDigest !== submission.filesDigest) {
    throw new ApiError(400, "filesDigest mismatch");
  }

  // check for exact duplicates
  const existing = ZExtensionRecord.safeParse(
    await dbc.findOne({ filesDigest }),
  );
  if (existing.success) {
    throw new ApiError(
      409,
      `Exact duplicate of existing extension: ${existing.data._id} version ${existing.data.version}`,
    );
  }

  errors.push("Not implemented");
  if (errors.length > 0) {
    return {
      _id: randomIdentifier("ext"),
      object: "extension",
      created: new Date(),
      ...submission,
      status: "rejected",
      message: errors.join("\n"),
    };
  } else {
    throw new ApiError(400, "Not implemented");
  }
}
