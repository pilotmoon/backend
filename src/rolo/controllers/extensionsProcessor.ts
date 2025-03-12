import { alphabets, baseEncode } from "@pilotmoon/chewit";
import {
  configFromText,
  extractSummary,
  loadStaticConfig,
  validateStaticConfig,
} from "@pilotmoon/fudge";
import type { Collection } from "mongodb";
import { createHash } from "node:crypto";
import { z } from "zod";
import { gitHash } from "../../common/blobSchemas.js";
import { ApiError } from "../../common/errors.js";
import {
  type ExtensionFileList,
  type ExtensionFileListEntry,
  type ExtensionInfo,
  type ExtensionOrigin,
  type ExtensionSubmission,
  type IconComponents,
  ZExtensionInfo,
  ZPartialExtensionRecord,
  isConfigFileName,
} from "../../common/extensionSchemas.js";
import { log } from "../../common/log.js";
import { compareVersionStrings } from "../../common/versionString.js";
import type { Auth, AuthKind } from "../auth.js";
import { randomIdentifier } from "../identifiers.js";
import {
  createAuthorInternal,
  readAuthorByGithubIdInternal,
} from "./authorsController.js";
import { createBlobInternal, readBlobInternal } from "./blobsController.js";

export const ZExtensionRecord = ZPartialExtensionRecord.extend({
  _id: z.string(),
  // can be added in post-processing
  firstCreated: z.date().optional(),
  download: z.string().optional(),
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
): Promise<ExtensionFileList> {
  return await Promise.all(
    files.map(async (file) => {
      const data = (await readBlobInternal(file.hash, authKind, true))
        ?.dataBuffer;
      if (!data) {
        throw new Error("File not found in blob store");
      }
      return { ...file, data };
    }),
  );
}

const PILOTMOON_OWNER_ID = 17520;
function githubOwnerIdFromOrigin(origin: ExtensionOrigin) {
  if (origin.type === "githubRepo") {
    return origin.ownerId;
  }
  if (origin.type === "githubGist") {
    return origin.ownerId;
  }
  return null;
}

async function getConfigFile(
  files: ExtensionFileList,
): Promise<ExtensionFileListEntry> {
  // look forfiles named like a config file
  const configs = files.filter((file) => isConfigFileName(file.path));

  // got one?
  if (configs.length === 1) {
    return configs[0];
  }

  // got more than one?
  if (configs.length > 1) {
    throw new ApiError(400, "Only one config file is allowed");
  }

  // we have no config files, so look for a snippet in the files to use as the config
  const snippets = [];
  for (const file of files) {
    if (!file.data) {
      throw new Error("File data is missing");
    }
    const parsed = configFromText(
      file.data.toString("utf8"),
      fileNameSuffix(file.path),
    );
    if (parsed) {
      snippets.push({ file, parsed });
    }
  }

  // no snippets?
  if (snippets.length === 0) {
    throw new ApiError(400, "Expected a Config file or a snippet in the files");
  }

  // multiple smippets?
  if (snippets.length > 1) {
    throw new ApiError(400, "Found more than one snippet in the files");
  }

  // single snippet, we're good
  const { parsed, file } = snippets[0];
  log("snippet path", file.path);
  log("parsed", parsed);
  return {
    ...file,
    path: parsed.fileName,
    executable: parsed.isExecutable ? true : undefined,
  };
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
    return `githubRepo:${origin.ownerHandle}/${origin.repoName}/${
      origin.nodePath
    }${origin.nodeType === "tree" ? "/" : ""} (repoId:${origin.repoId})`;
  }
  if (origin.type === "githubGist") {
    return `githubGist:${origin.gistId} (owner:${origin.ownerHandle})`;
  }
  return "unknown origin";
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
    if (!file.data) {
      throw new Error("File data is missing");
    }
    if (file.data.length !== file.size) {
      throw new Error("File size mismatch");
    }
    const dataHash = gitHash(file.data, "sha256").toString("hex");
    if (dataHash !== file.hash) {
      throw new Error("File hash mismatch");
    }
    mlog(`File ${file.hash} ${file.path} OK`);
  }

  // find the config file
  const configFile = await getConfigFile(files);
  if (!configFile.data) {
    throw new Error("File data is missing");
  }

  // modify the file list entry
  const configFileEntry = submission.files.find(
    (file) => file.hash === configFile.hash,
  );
  if (!configFileEntry) {
    throw new Error("No config file entry");
  }
  configFileEntry.path = configFile.path;
  configFileEntry.executable = configFile.executable;
  mlog(`Config file ${configFile.path} from ${configFileEntry.path}`);

  const config = (() => {
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
      return validateStaticConfig(staticConfig);
    } catch (e) {
      throw new ApiError(
        400,
        `Config load error: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  })();

  mlog("Config validated OK");
  if (!config.identifier) {
    throw new ApiError(400, "Extension 'identifier' field is required.");
  }
  if (!config.description) {
    throw new ApiError(400, "Extension 'description' field is required.");
  }
  if (!config["popclip version"]) {
    throw new ApiError(400, "Extension 'popclip version' field is required.");
  }

  // needed for action type detection
  if (configFile.path === "Config.js" || configFile.path === "Config.ts") {
    config.module = true;
  }

  // get the info from the config
  const info = ZExtensionInfo.parse({
    ...extractSummary(config),
    type: "popclip",
  });
  mlog(`Identifier is ${info.identifier}`);

  // check we have at least one action type
  if (info.actionTypes.length === 0) {
    throw new ApiError(400, "Extension has no action types");
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
  let shortcode: string | undefined;
  let unlisted = true;
  const mostRecent = await dbc.findOne(
    { "info.identifier": info.identifier },
    { sort: { created: -1 } },
  );
  if (mostRecent) {
    const mostRecentParsed = ZExtensionRecord.parse(mostRecent);
    mlog(`Most recent submission is ${mostRecentParsed.version}`);

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

    if (submission.version) {
      // version must be newer
      if (
        !mostRecentParsed.allowLowerVersion &&
        compareVersionStrings(submission.version, mostRecentParsed.version) <= 0
      ) {
        throw new ApiError(
          400,
          `Version ${submission.version} is not higher than ${mostRecentParsed.version}`,
        );
      }
    } else {
      // add 1
      submission.version = (
        Number.parseInt(mostRecentParsed.version) + 1
      ).toString();
    }

    shortcode = mostRecentParsed.shortcode;
    mlog(`Using previous submission shortcode: ${shortcode}`);
    unlisted = mostRecentParsed.unlisted ?? false;
    mlog(`Using previous submission unlisted state: ${unlisted}`);
  } else {
    mlog("No previous submission found this identifier");

    // generate a new shortcode
    let hashInput = info.identifier;
    let count = 0;
    while (count < 10 && !shortcode) {
      const candidate = sha256Base32(hashInput).slice(-6);
      const existing = await dbc.findOne(
        { shortcode: candidate },
        { projection: { _id: 1 } },
      );
      if (existing) {
        hashInput = `${candidate}+`;
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
      mlog("Starting auto version at 1");
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

  // save icon data to blob if needed
  if (info.icon) {
    info.icon = await blobbifyIcon(info.icon, auth.kind);
  }

  // save the author info
  createAuthorInternal(submission.author, auth.kind);

  return {
    _id: randomIdentifier("ext"),
    object: "extension",
    created: new Date(),
    version: submission.version,
    shortcode,
    info,
    origin: submission.origin,
    files: submission.files,
    published: await shouldPublish(submission.origin, info, auth.kind),
    unlisted,
  };
}

// if the icon is svg: or data:, store it as a blob
async function blobbifyIcon(
  components: IconComponents,
  authKind: AuthKind,
): Promise<IconComponents> {
  let data = null;
  let fileExt = null;
  if (components.prefix === "svg") {
    data = Buffer.from(components.payload);
    fileExt = "svg";
  } else if (components.prefix === "data") {
    const match = components.payload.match(
      /^((?<mediatype>[^;]+)?(;(?<encoding>base64))?,(?<payload>.+))$/s,
    );
    if (!match) {
      throw new ApiError(400, "Unsupported data URL");
    }
    log(match.groups);
    if (match.groups?.mediatype === "image/svg+xml") {
      fileExt = "svg";
    } else if (match.groups?.mediatype === "image/png") {
      fileExt = "png";
    } else {
      throw new ApiError(400, "Unsupported data URL media type");
    }
    if (match.groups?.encoding === "base64") {
      data = Buffer.from(match.groups.payload, "base64");
    } else if (!match.groups?.encoding) {
      // remove percent encoding if present
      data = Buffer.from(decodeURIComponent(match.groups.payload));
    } else {
      throw new ApiError(400, "Unsupported data URL encoding");
    }
  }
  if (data && fileExt) {
    // upload to blob store
    const blobRecord = await createBlobInternal(data, authKind);
    return {
      prefix: "blob",
      payload: `${fileExt},${blobRecord.document._id.slice("blob_".length)}`,
      modifiers: components.modifiers,
    };
  }
  return components;
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
