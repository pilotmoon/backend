import { Document } from "mongodb";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ExtensionFileList,
  ExtensionOrigin,
  ZExtensionPatch,
  ZExtensionSubmission,
} from "../../common/extensionSchemas.js";
import {
  PositiveSafeInteger,
  ZLocalizableString,
  ZSaneDate,
  ZSaneIdentifier,
  ZSaneLongString,
  ZSaneString,
} from "../../common/saneSchemas.js";
import {
  createExtension,
  listExtensions,
  readExtension,
  updateExtension,
} from "../controllers/extensionsController.js";
import {
  ExtensionRecord,
  IconComponents,
  ZExtensionAppInfo,
  ZExtensionRecord,
} from "../controllers/extensionsProcessor.js";
import { makeIdentifierPattern } from "../identifiers.js";
import { AppContext, makeRouter } from "../koaWrapper.js";
import { setBodySpecialFormat } from "../makeFormats.js";
import { stringFromQuery } from "../query.js";
import { ZVersionString } from "../../common/versionString.js";
import { descriptorStringFromComponents } from "@pilotmoon/fudge";
import { log } from "../../common/log.js";
import { truncatedHash } from "../../common/blobSchemas.js";
import { endpointFileName } from "./blobsRouter.js";
import path from "node:path";

export const ZAugmentedExtensionRecord = ZExtensionRecord.extend({
  firstCreated: z.date(),
  download: z.string().nullish(),
});
export type AugmentedExtensionRecord = z.infer<
  typeof ZAugmentedExtensionRecord
>;

export const router = makeRouter({ prefix: "/extensions" });
const matchId = {
  pattern: makeIdentifierPattern("id", "ext"),
  uuid: randomUUID(),
};
const matchFile = {
  pattern: `${matchId.pattern}/file`,
  uuid: randomUUID(),
};

router.post("/", async (ctx) => {
  const submission = ZExtensionSubmission.strict().parse(ctx.request.body);
  const document = await createExtension(submission, ctx.state.auth);
  ctx.body = document;
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

router.patch(matchId.uuid, matchId.pattern, async (ctx) => {
  if (
    await updateExtension(
      ctx.params.id,
      ZExtensionPatch.parse(ctx.request.body),
      ctx.state.auth,
    )
  ) {
    ctx.status = 204;
  }
});

// add download url field
function expand<T extends ExtensionRecord>(document: T, ctx: AppContext) {
  const url = ctx.getLocation(matchFile.uuid, {
    id: document._id,
  });
  return {
    ...document,
    download: document.published ? url : null,
  };
}

router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readExtension(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = expand(document, ctx);
  }
});

// get file by shortcode and version
router.get(matchFile.uuid, matchFile.pattern, async (ctx) => {
  const document = await readExtension(ctx.params.id, ctx.state.auth);
  throw new Error("Not implemented");
  // TODO: implement file download
});

router.get("/", async (ctx) => {
  const view = stringFromQuery(ctx.query, "view", "");
  const query = ctx.query;
  if (view === "popclip") {
    query.published = "1";
    query["info.type"] = "popclip";
    query.extract = undefined;
    query.project = undefined;
  }
  let documents: Document[] = await listExtensions(
    query,
    ctx.state.pagination,
    ctx.state.auth,
  );
  documents = documents.map((doc) => {
    const parsed = ZAugmentedExtensionRecord.safeParse(doc);
    if (!parsed.success) {
      return document;
    }
    const expanded = expand(parsed.data, ctx);
    if (view === "popclip") {
      return popclipView(expanded);
    }
    return expanded;
  });

  if (!setBodySpecialFormat(ctx, documents)) {
    ctx.body = documents;
  }
});

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
  demo: z.string().nullable(),
  readme: z.string().nullable(),
  source: z.string().nullable(),
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

// suffux e.g. (-)readme.md or (-)demo.mp4
function findFileBlob(suffix: string, files: ExtensionFileList) {
  const regex = new RegExp(`(?:-${suffix}$|^${suffix}$)`, "i");
  const file = files.find((f) => regex.test(f.path));
  const fileExt = file?.path.split(".").pop();
  return file ? `/blobs/${thash(file.hash)}/file.${fileExt}` : null;
}

function popclipView(doc: AugmentedExtensionRecord) {
  const description = extractLocalizedString(doc.info.description ?? "");
  const icon = doc.info.icon
    ? descriptorStringFromComponents(swapFileIcon(doc.info.icon, doc.files))
    : null;
  const view: PopClipDirectoryView = {
    _id: doc._id,
    object: "extension",
    created: doc.created,
    firstCreated: doc.firstCreated,
    shortcode: doc.shortcode,
    identifier: doc.info.identifier,
    version: doc.version,
    name: extractLocalizedString(doc.info.name),
    icon,
    description,
    // descriptionHtml: linkifyDescription(description, doc.info.apps ?? []),
    keywords: extractLocalizedString(doc.info.keywords ?? ""),
    download: doc.download ?? null,
    demo:
      findFileBlob("demo.mp4", doc.files) ??
      findFileBlob("demo.gif", doc.files),
    readme: findFileBlob("readme.md", doc.files),
    source: extractSourceUrl(doc.origin),
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
