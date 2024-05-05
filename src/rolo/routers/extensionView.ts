import { z } from "zod";
import {
  ZLocalizableString,
  ZSaneDate,
  ZSaneIdentifier,
} from "../../common/saneSchemas.js";
import { ZVersionString } from "../../common/versionString.js";
import {
  ExtensionRecord,
  IconComponents,
  ZExtensionAppInfo,
  ZExtensionRecord,
} from "../controllers/extensionsProcessor.js";
import {
  ExtensionFileList,
  ExtensionOrigin,
} from "../../common/extensionSchemas";
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
});

const ZPopClipDirectoryView = ZPartialPopClipDirectoryView.extend({
  _id: z.string(),
  created: ZSaneDate,
  firstCreated: ZSaneDate,
  object: z.literal("extension"),
  shortcode: z.string(),
  identifier: ZSaneIdentifier,
  icon: z.string().nullable(),
  description: z.string(),
  keywords: z.string(),
  owner: z.string().nullable(),
  apps: z.array(ZExtensionAppInfo),
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

function extractLocalizedString(ls: z.infer<typeof ZLocalizableString>) {
  return typeof ls === "string" ? ls : ls?.en ?? "<missing>";
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

function extractOwnerTag(origin: ExtensionOrigin) {
  if (origin.type === "githubGist") {
    return `github:${origin.ownerId}`;
  } else if (origin.type === "githubRepo") {
    return `github:${origin.ownerId}`;
  }
  return null;
}

function thash(hash: string) {
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

export function popclipView(doc: ExtensionRecordWithHistory) {
  const view: PopClipDirectoryView = {
    _id: doc._id,
    object: "extension",
    created: doc.created,
    firstCreated: doc.firstCreated!,
    shortcode: doc.shortcode,
    identifier: doc.info.identifier,
    version: doc.version,
    name: extractLocalizedString(doc.info.name),
    icon: doc.info.icon
      ? descriptorStringFromComponents(swapFileIcon(doc.info.icon, doc.files))
      : null,
    description: extractLocalizedString(doc.info.description ?? ""),
    keywords: extractLocalizedString(doc.info.keywords ?? ""),
    download: doc.download ?? null,
    source: extractSourceUrl(doc.origin),
    sourceDate: extractSourceDate(doc.origin),
    owner: extractOwnerTag(doc.origin),
    //actionTypes: doc.info.actionTypes ?? [],
    //entitlements: doc.info.entitlements ?? [],
    apps: doc.info.apps ?? [],
    //macosVersion: doc.info.macosVersion ?? null,
    //popclipVersion: doc.info.popclipVersion ?? null,
    files: doc.files.map((f) => ({
      path: f.path,
      url: `/blobs/${thash(f.hash)}/${endpointFileName(f.path)}`,
      executable: f.executable || undefined,
    })),
    previousVersions: doc.previousVersions.map((pv) => ({
      created: pv.created,
      version: pv.version,
      name: extractLocalizedString(pv.info.name),
      download: pv.download ?? null,
      source: extractSourceUrl(pv.origin),
      sourceDate: extractSourceDate(pv.origin),
    })),
  };
  return ZPopClipDirectoryView.parse(view);
}
