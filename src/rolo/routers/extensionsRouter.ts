import { create as createCDH } from "content-disposition-header";
import { Document } from "mongodb";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../common/errors.js";
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
import { ZExtensionRecord } from "../controllers/extensionsProcessor.js";
import { makeIdentifierPattern } from "../identifiers.js";
import { AppContext, makeRouter } from "../koaWrapper.js";
import { setBodySpecialFormat } from "../makeFormats.js";
import { filesExcludeRegex, generateExtensionFile } from "./extensionFile.js";
import { ZExtensionRecordWithHistory, popclipView } from "./extensionView.js";

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
  ctx.set("Content-Disposition", createCDH(name));
  //ctx.set("Cache-Control", "public, max-age=60"); // TODO - lengthen
});

// get a list of extensions with query parameters
router.get("/", async (ctx) => {
  const view = stringFromQuery(ctx.query, "view", "");
  const query = ctx.query;
  if (view === "popclipDirectory") {
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
    if (view !== "popclipDirectory") {
      const parsed = ZExtensionRecord.passthrough().safeParse(doc);
      if (!parsed.success) return doc; // e.g. is project or extract has been used
      expand(parsed.data, ctx);
      return parsed.data;
    } else {
      const document = ZExtensionRecordWithHistory.parse(doc);
      expand(document, ctx);
      for (const ver of document.previousVersions) {
        expand(ver, ctx);
      }
      return popclipView(document);
    }
  });

  if (!setBodySpecialFormat(ctx, documents)) {
    ctx.body = documents;
  }
});
