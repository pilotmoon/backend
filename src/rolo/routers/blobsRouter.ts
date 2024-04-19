import { randomUUID } from "crypto";
import { z } from "zod";
import {
  ZBlobCoreRecord,
  createBlob,
  deleteBlob,
  listBlobs,
  readBlob,
} from "../controllers/blobsController.js";
import { makeGenericIdPattern, makeIdentifierPattern } from "../identifiers.js";
import { makeRouter } from "../koaWrapper.js";
import { arrayFromQuery, boolFromQuery, stringFromQuery } from "../query.js";
import { setBodySpecialFormat } from "../makeFormats.js";
import { BlobHash, ZBlobHash } from "../../common/blobSchemas.js";
import { ApiError } from "../../common/errors.js";
import { log } from "../../common/log.js";

export const router = makeRouter({ prefix: "/blobs" });
const matchId = {
  pattern: makeGenericIdPattern("id"),
  uuid: randomUUID(),
};

const lookup = {
  txt: "text/plain",
  png: "image/png",
  svg: "image/svg+xml",
  gif: "image/gif",
  mp4: "video/mp4",
  md: "text/markdown",
};
const filePattern = `file(?:\.(?:${Object.keys(lookup).join("|")}))?`;
const matchFile = {
  pattern: `${matchId.pattern}/:filename(${filePattern})`,
  uuid: randomUUID(),
};
function contentTypeFromFileName(filename: string): string {
  const ext = filename.split(".").pop() ?? "";
  return (lookup as Record<string, string>)[ext] ?? "application/octet-stream";
}

const ZBlobSubmission = z.object({
  data: z.string(),
});

const ZBlobBase64Record = ZBlobCoreRecord.extend({
  data: z.string().optional(),
});

const PUBLIC_CACHE = "public, max-age=15";

router.post("/", async (ctx) => {
  const submission = ZBlobSubmission.strict().parse(ctx.request.body);
  const data = Buffer.from(submission.data, "base64");
  const { document, isDuplicate } = await createBlob(data, ctx.state.auth);
  ctx.body = document;
  ctx.status = isDuplicate ? 200 : 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const includeData = boolFromQuery(ctx.query, "includeData", false);
  const document = await readBlob(ctx.params.id, ctx.state.auth, includeData);
  if (document) {
    ctx.body = ZBlobBase64Record.parse({
      ...document,
      data: document.dataBuffer?.toString("base64"),
    });
    ctx.set("Cache-Control", PUBLIC_CACHE);
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
  ctx.set("Cache-Control", PUBLIC_CACHE);
});

router.get("/", async (ctx) => {
  const hashes: BlobHash[] = z
    .array(ZBlobHash)
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
  ctx.set("Cache-Control", PUBLIC_CACHE);
});

// delete blob
router.delete(matchId.pattern, async (ctx) => {
  if (await deleteBlob(ctx.params.id, ctx.state.auth)) {
    ctx.status = 204;
  }
});
