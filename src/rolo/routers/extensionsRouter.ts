import { create as createCDH } from "content-disposition-header";
import { Document } from "mongodb";
import { randomUUID } from "node:crypto";
import {
  ExtensionAppInfo,
  ExtensionFileList,
  ZExtensionPatch,
  ZExtensionSubmission,
} from "../../common/extensionSchemas.js";
import { stringFromQuery } from "../../common/query.js";
import {
  createExtension,
  listExtensions,
  readExtension,
  readExtensionWithData,
  updateExtension,
} from "../controllers/extensionsController.js";
import {
  ExtensionRecord,
  ZExtensionRecord,
} from "../controllers/extensionsProcessor.js";
import { makeIdentifierPattern } from "../identifiers.js";
import { AppContext, makeRouter } from "../koaWrapper.js";
import { setBodySpecialFormat } from "../makeFormats.js";
import { filesExcludeRegex, generateExtensionFile } from "./extensionFile.js";
import {
  ZExtensionRecordWithHistory,
  popclipView,
  thash,
} from "./extensionView.js";
import { extractDefaultString } from "../../common/saneSchemas.js";

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
function expand(
  document: { _id: string; published?: boolean; download?: string },
  ctx: AppContext,
) {
  const url = ctx.getLocation(matchFile.uuid, { id: document._id });
  if (document.published) {
    document.download = url;
  }
}

// get extension data, optionally including file data
router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readExtension(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = expand(document, ctx);
  }
});

// get file
router.get(matchFile.uuid, matchFile.pattern, async (ctx) => {
  const document = await readExtensionWithData(
    ctx.params.id,
    ctx.state.auth,
    filesExcludeRegex(),
  );
  if (!document) return;

  const { data, name } = await generateExtensionFile(
    document,
    ctx.state.auth.kind,
  );
  ctx.body = data;
  ctx.set("Content-Type", "application/octet-stream");
  const fallback = name.replace(/[^\x20-\x7e]/g, "?"); // only ascii printable
  ctx.set("Content-Disposition", createCDH(name, { fallback }));
  ctx.set("Cache-Control", "public, max-age=604800, immutable");
});

router.get("/", async (ctx) => {
  const view = stringFromQuery(ctx.query, "view", "");
  await handleList(ctx, view);
});

router.get("/popclip.rss", async (ctx) => {
  ctx.state.pagination.sortBy = "firstCreated";
  ctx.state.pagination.limit = 100;
  await handleList(ctx, "popclipRss");
  ctx.set("Cache-Control", "public, max-age=300");
});

async function handleList(ctx: AppContext, view?: string) {
  const query = ctx.query;
  if (view === "popclipDirectory" || view === "popclipRss") {
    query.published = "1";
    query["info.type"] = "popclip";
    query.flatten = "1";
  }
  let documents: Document[] = await listExtensions(
    query,
    ctx.state.pagination,
    ctx.state.auth,
  );
  documents = documents.map((doc) => {
    if (view === "popclipDirectory") {
      const document = ZExtensionRecordWithHistory.parse(doc);
      expand(document, ctx);
      for (const ver of document.previousVersions) {
        expand(ver, ctx);
      }
      return popclipView(document);
    } else {
      const parsed = ZExtensionRecord.passthrough().safeParse(doc);
      if (!parsed.success) return doc; // e.g. is project or extract has been used
      expand(parsed.data, ctx);
      return parsed.data;
    }
  });

  if (view === "popclipRss") {
    makeRss(ctx, documents as ExtensionRecord[]);
    return;
  }
  if (setBodySpecialFormat(ctx, documents)) {
    return;
  }
  ctx.body = documents;
}

function linkifyDescription(description: string, apps: ExtensionAppInfo[]) {
  let html = description;
  for (const app of apps) {
    html = description.replace(
      new RegExp(`\\b${app.name}\\b`),
      `<a href="${app.link}">${app.name}</a>`,
    );
  }
  return html;
}

// either bare e.g. readme.md or suffixed e.g. blah-demo.mp4
// and only in root folder
function findSpecialFile(suffix: string, files: ExtensionFileList) {
  const regex = new RegExp(`(^([^/]+-)?${suffix}$)`, "i");
  const file = files.find((f) => regex.test(f.path));
  return file?.hash ?? null;
}

function makeRss(ctx: AppContext, documents: ExtensionRecord[]) {
  const parts: string[] = [];
  let publicRoot = "https://public.popclip.app";
  let webUrl = "https://www.popclip.app/extensions/";
  parts.push(
    `
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>PopClip Extensions</title>
<link>${webUrl}</link>
<atom:link href="${publicRoot}/extensions/popclip/rss" rel="self" type="application/rss+xml" />
<description>A feed of extensions published to the PopClip Extensions Directory.</description>
<language>en</language>`.trim(),
  );

  for (const ext of documents) {
    let title = extractDefaultString(ext.info.name);
    let description = linkifyDescription(
      extractDefaultString(ext.info.description),
      ext.info.apps ?? [],
    );

    // if (ext.download) {
    //   description += `<br><a href="${publicRoot}${ext.download}">Download</a>`;
    // }

    let mp4Hash = findSpecialFile("demo.mp4", ext.files);
    let gifHash = findSpecialFile("demo.gif", ext.files);

    if (mp4Hash) {
      description += `<br><video src="${publicRoot}/blobs/${thash(
        mp4Hash,
      )}/file.mp4" alt="Demo Video" autoplay loop playsinline>Browser can't show this video.</video>`;
    } else if (gifHash) {
      description += `<br><img src="${publicRoot}/blobs/${thash(
        gifHash,
      )}/file.gif" alt="Demo GIF" >`;
    }

    let perma = `${webUrl}x/${ext.shortcode}`;
    let datestr = ext.firstCreated!.toISOString();

    parts.push(
      `
<item>
    <title>${title}</title>
    <guid isPermaLink="false">${ext.info.identifier}</guid>
    <description><![CDATA[<p>${description}</p>]]></description>
    <link>${perma}</link>
    <pubDate>${datestr}</pubDate>
</item>`.trim(),
    );
  }

  parts.push("</channel></rss>");

  ctx.body = parts.join("\n");
  ctx.set("Content-Type", "application/rss+xml");
}
