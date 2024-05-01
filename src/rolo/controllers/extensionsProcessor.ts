import { z } from "zod";
import {
  ExtensionDataFileList,
  ExtensionFileList,
  ExtensionOrigin,
  ExtensionSubmission,
  ZExtensionFileList,
  ZExtensionOrigin,
  ZExtensionPatch,
  calculateDigest,
  isConfigFileName,
} from "../../common/extensionSchemas.js";
import {
  PositiveSafeInteger,
  ZSaneIdentifier,
  ZSaneString,
} from "../../common/saneSchemas.js";
import { Collection } from "mongodb";
import { readBlobInternal } from "./blobsController.js";
import { Auth, AuthKind } from "../auth.js";
import { ZBlobHash2, gitHash } from "../../common/blobSchemas.js";
import { log } from "../../common/log.js";
import {
  extractSummary,
  loadStaticConfig,
  validateStaticConfig,
} from "@pilotmoon/fudge";
import { configFromText } from "@pilotmoon/fudge";
import { alphabets, baseEncode } from "@pilotmoon/chewit";
import { createHash } from "node:crypto";
import { ApiError } from "../../common/errors.js";
import { randomIdentifier } from "../identifiers.js";
import {
  ZVersionString,
  compareVersionStrings,
} from "../../common/versionString.js";
import {
  createAuthorInternal,
  readAuthorByGithubIdInternal,
} from "./authorsController.js";

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
  type: z.literal("popclip"),
  name: ZSaneString,
  identifier: ZSaneIdentifier.optional(),
  description: ZSaneString.optional(),
  keywords: ZSaneString.optional(),
  icon: ZIconComponents.optional(),
  actionTypes: z.array(ZSaneString).optional(),
  entitlements: z.array(ZSaneString).optional(),
  apps: z.array(ZExtensionAppInfo).optional(),
  macosVersion: ZSaneString.optional(),
  popclipVersion: PositiveSafeInteger.optional(),
});
type ExtensionInfo = z.infer<typeof ZExtensionInfo>;

export const ZExtensionRecord = ZExtensionPatch.extend({
  _id: z.string(),
  object: z.literal("extension"),
  created: z.date(),
  shortcode: z.string(),
  version: ZVersionString,
  info: ZExtensionInfo,
  origin: ZExtensionOrigin,
  filesDigest: ZBlobHash2,
  files: ZExtensionFileList,
});
export type ExtensionRecord = z.infer<typeof ZExtensionRecord>;

export function sha256Base32(message: string) {
  return baseEncode(
    Array.from(createHash("sha256").update(message).digest()),
    alphabets.base32Crockford,
  ).toLowerCase();
}

// return the part after the last dot in the file name, else ""
function fileNameSuffix(fileName: string) {
  return fileName.slice(fileName.lastIndexOf(".") + 1);
}

async function getFiles(
  files: ExtensionFileList,
  authKind: AuthKind,
): Promise<ExtensionDataFileList> {
  return await Promise.all(
    files.map(async (file) => {
      const data = (await readBlobInternal(file.hash, authKind, true))
        ?.dataBuffer;
      if (!data) {
        throw new Error(`File not found in blob store`);
      }
      return { ...file, data };
    }),
  );
}

const PILOTMOON_OWNER_ID = 17520;
function githubOwnerIdFromOrigin(origin: ExtensionOrigin) {
  if (origin.type === "githubRepo") {
    return origin.repoOwnerId;
  } else if (origin.type === "githubGist") {
    return origin.gistOwnerId;
  } else {
    return null;
  }
}

async function getConfigFile(files: ExtensionDataFileList) {
  let result;
  const configs = files.filter((file) => isConfigFileName(file.path));
  if (configs.length > 1) {
    throw new ApiError(400, "Only one config file is allowed");
  } else if (configs.length === 1) {
    result = configs[0];
  } else {
    const snippets = [];
    for (const file of files) {
      const parsed = configFromText(
        file.data.toString("utf8"),
        fileNameSuffix(file.path),
      );
      if (parsed) {
        snippets.push({ file, parsed });
      }
    }
    if (snippets.length === 0) {
      throw new ApiError(
        400,
        "Expected a Config file or a snippet in the files",
      );
    }
    if (snippets.length > 1) {
      throw new ApiError(400, "Found more than one snippet in the files");
    }
    const { parsed, file } = snippets[0];
    log("snippet path", file.path);
    log("parsed", parsed);
    result = {
      ...file,
      path: parsed.fileName,
      executable: parsed.isExecutable ? true : undefined,
    };
    log("result", file);
  }
  return result;
}

function sameOrigin(existing: ExtensionOrigin, candidate: ExtensionOrigin) {
  if (existing.type === "githubRepo" && candidate.type === "githubRepo") {
    return (
      existing.repoId === candidate.repoId &&
      existing.nodePath === candidate.nodePath &&
      existing.nodeType === candidate.nodeType
    );
  }
  if (existing.type === "githubGist" && candidate.type === "githubGist") {
    return existing.gistId === candidate.gistId;
  }
  return false;
}

function originDescription(origin: ExtensionOrigin) {
  if (origin.type === "githubRepo") {
    return `GitHub repo ${origin.repoId} (${origin.repoOwnerHandle}/${
      origin.repoName
    }/${origin.nodePath}${origin.nodeType === "tree" ? "/" : ""}})`;
  } else if (origin.type === "githubGist") {
    return `GitHub gist ${origin.gistId} (${origin.gistOwnerHandle})`;
  } else {
    return "unknown origin";
  }
}

export async function processSubmission(
  submission: ExtensionSubmission,
  dbc: Collection<ExtensionRecord>,
  auth: Auth,
): Promise<ExtensionRecord> {
  const messages: string[] = [];
  function mlog(message: string) {
    messages.push(message);
    log(message);
  }

  // first load all the files for this extension
  const files = await getFiles(submission.files, auth.kind);
  for (const file of files) {
    if (file.data.length !== file.size) {
      throw new Error(`File size mismatch`);
    }
    const dataHash = gitHash(file.data, "sha256").toString("hex");
    if (dataHash !== file.hash) {
      throw new Error(`File hash mismatch`);
    }
    mlog(`File ${file.hash} ${file.path} OK`);
  }

  // find the config file
  const configFile = await getConfigFile(files);

  // modify the file list entry
  const configFileEntry = submission.files.find(
    (file) => file.hash === configFile.hash,
  )!;
  configFileEntry.path = configFile.path;
  configFileEntry.executable = configFile.executable;
  mlog(`Config file ${configFile.path} from ${configFileEntry.path}`);

  let config;
  try {
    const staticConfig = loadStaticConfig([
      {
        name: configFile.path,
        contents: configFile.data.toString("utf8"),
      },
    ]);
    if (!staticConfig || Object.keys(staticConfig).length === 0) {
      throw new Error(`No config found in ${configFile.path}`);
    }
    config = validateStaticConfig(staticConfig);
  } catch (e) {
    throw new ApiError(
      400,
      `Config load error: ${e instanceof Error ? e.message : "unknown"}`,
    );
  }
  mlog("Config validated OK");
  if (!config.identifier) {
    throw new ApiError(400, "No identifier found in config");
  }
  mlog(`Identifier is ${config.identifier}`);

  // get the info from the config
  const info = ZExtensionInfo.parse({
    ...extractSummary(config),
    type: "popclip",
  });

  // make sure we have identifier and description
  if (!info.identifier) {
    throw new ApiError(400, "Extension 'identifier' field is required.");
  }
  if (!info.description) {
    throw new ApiError(400, "Extension 'description' field is required.");
  }

  // might use this for something in future
  if (info.identifier.startsWith("app.popclip.")) {
    throw new ApiError(
      400,
      "Identifier starting with 'app.popclip.' is reserved",
    );
  }

  // check pilotmoon prefix
  const originIsPilotmoon =
    githubOwnerIdFromOrigin(submission.origin) === PILOTMOON_OWNER_ID;
  if (info.identifier.startsWith("com.pilotmoon.") && !originIsPilotmoon) {
    throw new ApiError(
      400,
      "Extensions with identifiers starting with 'com.pilotmoon.' are reserved for @pilotmoon.",
    );
  }

  // look for most recent submission (by created date) with the same identifier
  let shortcode;
  const mostRecent = await dbc.findOne(
    { "info.identifier": config.identifier },
    { sort: { created: -1 } },
  );
  if (mostRecent) {
    const mostRecentParsed = ZExtensionRecord.parse(mostRecent);
    if (!mostRecentParsed.version) {
      throw new Error("Most recent submission has no version");
    }
    if (submission.version) {
      // version must be newer
      if (
        compareVersionStrings(submission.version, mostRecentParsed.version) <= 0
      ) {
        throw new ApiError(
          400,
          `Version ${submission.version} is not newer than ${mostRecentParsed.version}`,
        );
      }
    } else {
      // add 1
      submission.version = (
        Number.parseInt(mostRecentParsed.version) + 1
      ).toString();
    }

    // origin must be same
    if (
      !mostRecentParsed.allowOriginChange &&
      !sameOrigin(mostRecentParsed.origin, submission.origin)
    ) {
      throw new ApiError(
        400,
        `Extension identifier '${
          mostRecentParsed.info.identifier
        }' may only be updated from the same origin: ${originDescription(
          mostRecentParsed.origin,
        )}`,
      );
    }
    shortcode = mostRecentParsed.shortcode;
    mlog(`Using previous submission shortcode: ${shortcode}`);
  } else {
    mlog(`No previous submission found this identifier`);

    // generate a new shortcode
    let hashInput = config.identifier;
    let count = 0;
    while (count < 10 && !shortcode) {
      const candidate = sha256Base32(hashInput).slice(-6);
      const existing = await dbc.findOne(
        { shortcode: candidate },
        { projection: { _id: 1 } },
      );
      if (existing) {
        hashInput = candidate + "+";
        count++;
        mlog(`Shortcode ${candidate} already exists, trying again (${count})`);
      } else {
        shortcode = candidate;
        mlog(`Generated unique shortcode ${shortcode}`);
        break;
      }
    }

    // auto version, start at 1 for new submissions
    if (!submission.version) {
      mlog(`Starting auto version at 1`);
      submission.version = "1";
    }
  }

  // by now we should have shortcode and version
  if (!shortcode) {
    throw new Error("Failed to generate unique shortcode");
  }
  if (!submission.version) {
    throw new Error("Failed to generate version");
  }

  // save the author info
  createAuthorInternal(submission.author, auth.kind);

  // calculate the digest of the files we're going to store
  const filesDigest = calculateDigest(submission.files).toString("hex");
  mlog(`filesDigest ${filesDigest}`);

  return {
    _id: randomIdentifier("ext"),
    object: "extension",
    created: new Date(),
    version: submission.version,
    shortcode,
    info,
    origin: submission.origin,
    filesDigest,
    files: submission.files,
    published: await shouldPublish(submission.origin, info, auth.kind),
  };
}

async function shouldPublish(
  origin: ExtensionOrigin,
  _: ExtensionInfo,
  authKind: AuthKind,
) {
  const githubId = githubOwnerIdFromOrigin(origin);
  if (githubId === null) return false;
  const author = await readAuthorByGithubIdInternal(githubId, authKind);
  return !!author?.autoPublish;
}
