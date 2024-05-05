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

const ZPopClipDirectoryView = z.object({
  _id: z.string(),
  created: ZSaneDate,
  firstCreated: ZSaneDate,
  object: z.literal("extension"),
  shortcode: z.string(),
  identifier: ZSaneIdentifier,
  version: ZVersionString,
  name: z.string(),
  icon: z.string().nullable(),
  description: z.string(),
  // descriptionHtml: z.string(),
  keywords: z.string(),
  download: z.string().nullable(),
  // demo: z.string().nullable(),
  // readme: z.string().nullable(),
  source: z.string().nullable(),
  sourceDate: ZSaneDate.nullable(),
  owner: z.string().nullable(),
  // actionTypes: z.array(z.string()),
  // entitlements: z.array(z.string()),
  apps: z.array(ZExtensionAppInfo),
  // macosVersion: z.string().nullable(),
  // popclipVersion: PositiveSafeInteger.nullable(),
  files: z.array(
    z.object({
      path: z.string(),
      url: z.string(),
      executable: z.boolean().optional(),
    }),
  ),
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

export function popclipView(doc: ExtensionRecord) {
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
  };
  return ZPopClipDirectoryView.parse(view);
}
