import { z } from "zod";
import {
  LocalizableString,
  ZSaneDate,
  ZSaneIdentifier,
  extractDefaultString,
} from "../../common/saneSchemas.js";
import { ZVersionString } from "../../common/versionString.js";
import { ZExtensionRecord } from "../controllers/extensionsProcessor.js";
import {
  ExtensionFileList,
  ExtensionOrigin,
  IconComponents,
  ZExtensionAppInfo,
} from "../../common/extensionSchemas.js";
import { endpointFileName } from "./blobsRouter.js";
import { descriptorStringFromComponents } from "@pilotmoon/fudge";
import { truncatedHash } from "../../common/blobSchemas.js";
import path from "node:path";

export const ZExtensionRecordWithHistory = ZExtensionRecord.extend({
  previousVersions: z.array(ZExtensionRecord.omit({ files: true })),
});
export type ExtensionRecordWithHistory = z.infer<
  typeof ZExtensionRecordWithHistory
>;

const ZPartialPopClipDirectoryView = z.object({
  version: ZVersionString,
  name: z.string(),
  download: z.string().nullable(),
  source: z.string().nullable(),
  sourceDate: ZSaneDate.nullable(),
  sourceMessage: z.string().nullable(),
});

const ZAltString = z.object({
  lang: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
});
type AltString = z.infer<typeof ZAltString>;

const ZPopClipDirectoryView = ZPartialPopClipDirectoryView.extend({
  _id: z.string(),
  created: ZSaneDate,
  firstCreated: ZSaneDate,
  object: z.literal("extension"),
  shortcode: z.string(),
  identifier: ZSaneIdentifier,
  icon: z.string().nullable(),
  description: z.string(),
  altStrings: z.array(ZAltString).nullable(),
  keywords: z.string(),
  owner: z.string().nullable(),
  apps: z.array(ZExtensionAppInfo),
  actionTypes: z.array(z.string()),
  entitlements: z.array(z.string()),
  macosVersion: z.string().nullable(),
  popclipVersion: z.number().nullable(),
  files: z.array(
    z.object({
      path: z.string(),
      url: z.string(),
      executable: z.boolean().optional(),
    }),
  ),
  previousVersions: z.array(ZPartialPopClipDirectoryView),
});
type PopClipDirectoryView = z.infer<typeof ZPopClipDirectoryView>;

function extractAltStrings(
  name: LocalizableString,
  description: LocalizableString,
) {
  const altStrings = new Map<string, AltString>();
  const processEntries = (ls: LocalizableString, key: string) => {
    if (typeof ls === "object") {
      Object.entries(ls).forEach(([lang, value]) => {
        if (lang !== "en") {
          altStrings.set(lang, { ...altStrings.get(lang), lang, [key]: value });
        }
      });
    }
  };
  processEntries(name, "name");
  processEntries(description, "description");
  // sort by lang key
  if (!altStrings.size) return null;
  return Array.from(altStrings.values()).sort((a, b) =>
    a.lang.localeCompare(b.lang),
  );
}

function extractSourceUrl(origin: ExtensionOrigin) {
  if (origin.type === "githubGist") {
    return `https://gist.github.com/${origin.ownerHandle}/${origin.gistId}/${origin.commitSha}`;
  } else if (origin.type === "githubRepo") {
    return `https://github.com/${origin.ownerHandle}/${origin.repoName}/tree/${
      origin.commitSha
    }/${origin.nodePath}${origin.nodeType === "tree" ? "/" : ""}`;
  }
  return null;
}

function extractSourceDate(origin: ExtensionOrigin) {
  if (origin.type === "githubGist" || origin.type === "githubRepo") {
    return origin.commitDate;
  }
  return null;
}

function extractSourceMessage(origin: ExtensionOrigin) {
  if (origin.type === "githubRepo") {
    return origin.commitMessage;
  }
  return null;
}

function extractOwnerTag(origin: ExtensionOrigin) {
  if (origin.type === "githubGist") {
    return `github:${origin.ownerId}`;
  } else if (origin.type === "githubRepo") {
    return `github:${origin.ownerId}`;
  }
  return null;
}

export function thash(hash: string) {
  return truncatedHash(Buffer.from(hash, "hex"));
}

function swapFileIcon(icon: IconComponents, files: ExtensionFileList) {
  if (icon.prefix === "file") {
    const fileName = icon.payload;
    const fileNameExt = path.extname(fileName).slice(1);
    if (fileNameExt === "png" || fileNameExt === "svg") {
      // look for named icon in the package files
      const hash = files.find((f) => f.path === icon.payload)?.hash;
      if (hash) {
        return {
          prefix: "blob",
          payload: `${fileNameExt},${thash(hash)}`,
          modifiers: icon.modifiers,
        };
      }
    }
  }
  return icon;
}

function processIcon(
  icon: IconComponents | undefined,
  files: ExtensionFileList,
) {
  if (!icon) return null;
  return descriptorStringFromComponents(swapFileIcon(icon, files));
}

export function popclipView(doc: ExtensionRecordWithHistory) {
  const view: PopClipDirectoryView = {
    _id: doc._id,
    object: "extension",
    created: doc.created,
    firstCreated: doc.firstCreated!,
    shortcode: doc.shortcode,
    identifier: doc.info.identifier,
    version: doc.version,
    name: extractDefaultString(doc.info.name),
    icon: processIcon(doc.info.icon, doc.files),
    description: extractDefaultString(doc.info.description ?? ""),
    altStrings: extractAltStrings(doc.info.name, doc.info.description),
    keywords: extractDefaultString(doc.info.keywords ?? ""),
    download: doc.download ?? null,
    source: extractSourceUrl(doc.origin),
    sourceDate: extractSourceDate(doc.origin),
    sourceMessage: extractSourceMessage(doc.origin),
    owner: extractOwnerTag(doc.origin),
    apps: doc.info.apps ?? [],
    actionTypes: doc.info.actionTypes ?? [],
    entitlements: doc.info.entitlements ?? [],
    macosVersion: doc.info.macosVersion ?? null,
    popclipVersion: doc.info.popclipVersion ?? null,
    files: doc.files.map((f) => ({
      path: f.path,
      url: `/blobs/${thash(f.hash)}/${endpointFileName(f.path)}`,
      executable: f.executable || undefined,
    })),
    previousVersions: doc.previousVersions.map((pv) => ({
      created: pv.created,
      version: pv.version,
      name: extractDefaultString(pv.info.name),
      download: pv.download ?? null,
      source: extractSourceUrl(pv.origin),
      sourceDate: extractSourceDate(pv.origin),
      sourceMessage: extractSourceMessage(pv.origin),
    })),
  };
  return ZPopClipDirectoryView.parse(view);
}
