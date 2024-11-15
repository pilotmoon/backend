import { randomUUID } from "crypto";
import { z } from "zod";
import {
  ZBlobCoreRecord,
  createBlob,
  deleteBlob,
  listBlobs,
  readBlob,
} from "../controllers/blobsController.js";
import { makeGenericIdPattern } from "../identifiers.js";
import { makeRouter } from "../koaWrapper.js";
import { arrayFromQuery, boolFromQuery } from "../../common/query.js";
import { setBodySpecialFormat } from "../makeFormats.js";
import { ZBlobHash1, ZBlobHash2 } from "../../common/blobSchemas.js";
import { ApiError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import path from "node:path";

export const router = makeRouter({ prefix: "/blobs" });
const matchId = {
  pattern: makeGenericIdPattern("id"),
  uuid: randomUUID(),
};

const lookup = {
  txt: "text/plain; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  gif: "image/gif",
  mp4: "video/mp4",
  md: "text/markdown; charset=utf-8",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
const filePattern = `file(?:\\.(?:${Object.keys(lookup).join("|")}))?`;
const matchFile = {
  pattern: `${matchId.pattern}/:filename(${filePattern})`,
  uuid: randomUUID(),
};
function contentTypeFromFileName(filename: string): string {
  const ext = path.extname(filename).slice(1);
  return (lookup as Record<string, string>)[ext] ?? "application/octet-stream";
}
export function endpointFileName(filename: string) {
  const ext = path.extname(filename).slice(1);
  return (lookup as Record<string, string>)[ext] ? `file.${ext}` : "file";
}

const ZBlobSubmission = z.object({
  data: z.string(),
});

const ZBlobBase64Record = ZBlobCoreRecord.extend({
  data: z.string().optional(),
});

router.post("/", async (ctx) => {
  const submission = ZBlobSubmission.strict().parse(ctx.request.body);
  const data = Buffer.from(submission.data, "base64");
  const { document } = await createBlob(data, ctx.state.auth);
  ctx.body = document;
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const includeData = !!boolFromQuery(ctx.query, "includeData", false);
  const document = await readBlob(ctx.params.id, ctx.state.auth, includeData);
  if (document) {
    ctx.body = ZBlobBase64Record.parse({
      ...document,
      data: document.dataBuffer?.toString("base64"),
    });
  }
});

// get file
router.get(matchFile.uuid, matchFile.pattern, async (ctx) => {
  const contentType = contentTypeFromFileName(ctx.params.filename);
  log("requested " + ctx.params.filename + " with content type " + contentType);
  const document = await readBlob(ctx.params.id, ctx.state.auth, true);
  if (!document) return;
  if (!document.dataBuffer) {
    throw new ApiError(500, "Blob data is missing");
  }
  ctx.body = document.dataBuffer;
  ctx.set("Content-Type", contentType);
  ctx.set("Cache-Control", "public, max-age=604800, immutable");
});

router.get("/", async (ctx) => {
  const hashes: string[] = z
    .array(z.union([ZBlobHash1, ZBlobHash2]))
    .parse(arrayFromQuery(ctx.query, "hash", []));
  const documents = (
    await listBlobs(hashes, ctx.state.auth, ctx.state.pagination)
  ).map((document) =>
    ZBlobBase64Record.parse({
      ...document,
      data: document.dataBuffer?.toString("base64"),
    }),
  );
  if (!setBodySpecialFormat(ctx, documents)) {
    ctx.body = documents;
  }
});

// delete blob
router.delete(matchId.pattern, async (ctx) => {
  if (await deleteBlob(ctx.params.id, ctx.state.auth)) {
    ctx.status = 204;
  }
});
