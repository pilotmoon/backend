import { randomUUID } from "node:crypto";
import { makeIdentifierPattern } from "../identifiers.js";
import { makeRouter } from "../koaWrapper.js";
import {
  ZAuthorInfo,
  ZAuthorPatch,
  createAuthor,
  deleteAuthor,
  listAuthors,
  readAuthor,
  updateAuthor,
} from "../controllers/authorsController.js";

export const router = makeRouter({ prefix: "/authors" });
const matchId = {
  pattern: makeIdentifierPattern("id", "au"),
  uuid: randomUUID(),
};

router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readAuthor(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = document;
  }
});

router.post("/", async (ctx) => {
  const info = ZAuthorInfo.parse(ctx.request.body);
  const document = await createAuthor(info, ctx.state.auth);
  ctx.body = document;
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

router.patch(matchId.uuid, matchId.pattern, async (ctx) => {
  const patch = ZAuthorPatch.strict().parse(ctx.request.body);
  const document = await updateAuthor(ctx.params.id, patch, ctx.state.auth);
  if (document) {
    ctx.status = 204;
  }
});

router.get("/", async (ctx) => {
  const documents = await listAuthors(ctx.state.pagination, ctx.state.auth);
  ctx.body = documents;
});

router.delete(matchId.uuid, matchId.pattern, async (ctx) => {
  if (await deleteAuthor(ctx.params.id, ctx.state.auth)) {
    ctx.status = 204;
  }
});
