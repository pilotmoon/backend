import { randomUUID } from "node:crypto";
import { create as createCDH } from "content-disposition-header";
import type { Document } from "mongodb";
import {
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
  type ExtensionRecord,
  ZExtensionRecord,
} from "../controllers/extensionsProcessor.js";
import { etag } from "../etag.js";
import { makeIdentifierPattern } from "../identifiers.js";
import { type AppContext, makeRouter } from "../koaWrapper.js";
import { setBodySpecialFormat } from "../makeFormats.js";
import { filesExcludeRegex, generateExtensionFile } from "./extensionFile.js";
import { popclipView, ZExtensionRecordWithHistory } from "./extensionView.js";
import { makeRss } from "./rss.js";

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

// get extension data
router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readExtension(ctx.params.id, ctx.state.auth);
  if (document) {
    expand(document, ctx);
    ctx.body = document;
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
    }
    const parsed = ZExtensionRecord.passthrough().safeParse(doc);
    if (!parsed.success) return doc; // e.g. is project or extract has been used
    expand(parsed.data, ctx);
    return parsed.data;
  });

  if (view === "popclipRss") {
    const rssList = (documents as ExtensionRecord[]).filter((d) => !d.unlisted);
    makeRss(ctx, rssList);
    ctx.set(
      "Last-Modified",
      (rssList[0]?.firstCreated ?? new Date()).toUTCString(),
    );
    ctx.set("ETag", `"${etag(ctx.body)}"`);
    return;
  }
  if (setBodySpecialFormat(ctx, documents)) {
    return;
  }
  ctx.body = documents;
}
