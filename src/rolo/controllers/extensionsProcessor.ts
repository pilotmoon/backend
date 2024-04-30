import { z } from "zod";
import {
  ExtensionSubmission,
  ZExtensionSubmission,
  calculateDigest,
  isConfigFileName,
  isSnippetFileName,
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
import { readBlobInternal } from "./blobsController.js";
import { Auth } from "../auth.js";
import { ZBlobHash2, gitHash } from "../../common/blobSchemas.js";
import { log } from "../../common/log.js";
import { loadStaticConfig, validateStaticConfig } from "@pilotmoon/fudge";
import { configFromText } from "@pilotmoon/fudge";

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
  filesDigest: ZBlobHash2,
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

// return the part after the last dot in the file name, else ""
function fileNameSuffix(fileName: string) {
  return fileName.slice(fileName.lastIndexOf(".") + 1);
}

export async function processSubmission(
  submission: ExtensionSubmission,
  dbc: Collection<ExtensionRecord>,
  auth: Auth,
): Promise<ExtensionRecord> {
  const errors: string[] = [];

  // first load all the files for this extension, and check the hashes
  const files = await Promise.all(
    submission.files.map(async (file) => {
      const data = (await readBlobInternal(file.hash, auth.kind, true))
        ?.dataBuffer;
      if (!data) {
        throw new Error(`File not found in blob store`);
      }
      return { ...file, data };
    }),
  );
  for (const file of files) {
    if (file.data.length !== file.size) {
      throw new Error(`File size mismatch`);
    }
    const dataHash = gitHash(file.data, "sha256").toString("hex");
    if (dataHash !== file.hash) {
      throw new Error(`File hash mismatch`);
    }
    log(`File ${file.hash} OK`);
  }

  // find a single config file if present
  const configs = files.filter((file) => isConfigFileName(file.path));
  if (configs.length > 1) {
    throw new Error("More than one config file found");
  }
  const theConfigFile = configs[0];

  // find a single snippet file if present
  const snippets = files.filter((file) => isSnippetFileName(file.path));
  if (snippets.length > 1) {
    throw new Error("More than one snippet file found");
  }
  const theSnippetFile = snippets[0];

  // check we have exactly one
  if (theSnippetFile && theConfigFile) {
    throw new Error("Both config and snippet files found");
  }

  let processedConfigFile;
  if (theSnippetFile) {
    const contentsString = theSnippetFile.data.toString("utf8");
    const parsed = configFromText(
      contentsString,
      fileNameSuffix(theSnippetFile.path),
    );
    log("path", theSnippetFile.path);
    log("parsed", parsed);
    if (!parsed) {
      throw new Error(`Failed to parse snippet file '${snippets[0].path}'`);
    }
    processedConfigFile = {
      name: parsed.fileName,
      contents: contentsString,
    };
    // modify the snippet file object in place to add the path and executable
    const snippetFileEntry = submission.files.find(
      (file) => file.hash === theSnippetFile.hash,
    )!;
    snippetFileEntry.path = parsed.fileName;
    snippetFileEntry.executable ??= parsed.isExecutable;
    log("snippetfile", theSnippetFile);
  } else if (theConfigFile) {
    processedConfigFile = {
      name: theConfigFile.path,
      contents: theConfigFile.data.toString("utf8"),
    };
  } else {
    throw new Error("No config or snippet file found");
  }
  if (!processedConfigFile) {
    throw new Error("No config or snippet file found");
  }
  log(`Config file ${processedConfigFile.name}`);
  const config = validateStaticConfig(loadStaticConfig([processedConfigFile]));
  log(`Config validated: ${config}`);
  if (!config.identifier) {
    throw new Error("No identifier found in config");
  }

  // look for most recent accepted submission (by created date) with the same identifier
  const mostRecent = await dbc.findOne(
    {
      "info.identifier": config.identifier,
    },
    { sort: { created: -1 } },
  );
  if (mostRecent) {
    log(`Most recent submission:`, mostRecent);
  }

  // calculate the digest of the files we're going to store
  const filesDigest = calculateDigest(submission.files);
  log("files", submission.files);
  log("filesDigest", filesDigest);

  errors.push("Not implemented");
  if (errors.length > 0) {
    return {
      _id: randomIdentifier("ext"),
      object: "extension",
      created: new Date(),
      filesDigest,
      ...submission,
      status: "rejected",
      message: errors.join("\n"),
    };
  } else {
    throw new ApiError(400, "Not implemented");
  }
}
