import { randomUUID } from "crypto";
import { z } from "zod";
import {
  ZBlobCoreRecord,
  createBlob,
  deleteBlob,
  getBlobsByHashes,
  readBlob,
} from "../controllers/blobsController.js";
import { makeGenericIdPattern, makeIdentifierPattern } from "../identifiers.js";
import { makeRouter } from "../koaWrapper.js";
import { arrayFromQuery, boolFromQuery } from "../query.js";
import { setBodySpecialFormat } from "../makeFormats.js";
import { BlobHash, ZBlobHash } from "../../common/blobSchemas.js";

export const router = makeRouter({ prefix: "/blobs" });
const matchId = {
  pattern: makeGenericIdPattern("id"),
  uuid: randomUUID(),
};

const ZBlobSubmission = z.object({
  data: z.string(),
});

const ZBlobBase64Record = ZBlobCoreRecord.extend({
  data: z.string().optional(),
});

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
  }
});

router.get("/", async (ctx) => {
  const hashes: BlobHash[] = z
    .array(ZBlobHash)
    .parse(arrayFromQuery(ctx.query, "hash", []));
  const documents = (
    await getBlobsByHashes(hashes, ctx.state.auth, ctx.state.pagination)
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
