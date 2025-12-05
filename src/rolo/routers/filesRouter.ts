import { randomUUID } from "node:crypto";
import { create as createCDH } from "content-disposition-header";
import { ApiError } from "../../common/errors.js";
import { stringFromQuery } from "../../common/query.js";
import {
  createFile,
  deleteFile,
  listFiles,
  readFileById,
  streamFileByName,
} from "../controllers/filesController.js";
import { makePrefixedObjectIdPattern } from "../identifiers.js";
import { makeRouter } from "../koaWrapper.js";
import { setBodySpecialFormat } from "../makeFormats.js";

export const router = makeRouter({ prefix: "/files" });
const matchId = {
  pattern: makePrefixedObjectIdPattern("id", "file"),
  uuid: randomUUID(),
};

router.post("/", async (ctx) => {
  const name = stringFromQuery(ctx.query, "name", "").trim();
  if (!name) {
    throw new ApiError(400, "File name is required");
  }
  const document = await createFile(ctx.req, { name }, ctx.state.auth);
  ctx.body = document;
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

router.get("/", async (ctx) => {
  const nameFilter = stringFromQuery(ctx.query, "name", "").trim();
  const documents = await listFiles(
    ctx.state.pagination,
    ctx.state.auth,
    nameFilter || undefined,
  );
  if (!setBodySpecialFormat(ctx, documents)) {
    ctx.body = documents;
  }
});

router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readFileById(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = document;
    return;
  }
  ctx.status = 404;
});

router.get("/download/:identifier(.+)", async (ctx) => {
  const result = await streamFileByName(ctx.params.identifier, ctx.state.auth);
  if (!result) {
    ctx.status = 404;
    return;
  }
  ctx.body = result.stream;
  ctx.length = result.record.size;
  ctx.set("Content-Type", "application/octet-stream");
  ctx.set("Cache-Control", "public, max-age=3600, immutable");
  const fallback = result.record.name.replace(/[^\x20-\x7e]/g, "?");
  ctx.set("Content-Disposition", createCDH(result.record.name, { fallback }));
});

router.delete(matchId.uuid, matchId.pattern, async (ctx) => {
  const removed = await deleteFile(ctx.params.id, ctx.state.auth);
  if (!removed) {
    ctx.status = 404;
    return;
  }
  ctx.status = 204;
});
