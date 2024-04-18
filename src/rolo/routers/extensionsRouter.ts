import { randomUUID } from "node:crypto";
import { makeIdentifierPattern } from "../identifiers.js";
import { makeRouter } from "../koaWrapper.js";
import {
  createExtension,
  listExtensions,
  readExtension,
} from "../controllers/extensionsController.js";
import { ZExtensionSubmission } from "../../common/extensionSchemas.js";
import { Auth } from "../auth.js";

export const router = makeRouter({ prefix: "/extensions" });
const matchId = {
  pattern: makeIdentifierPattern("id", "ext"),
  uuid: randomUUID(),
};

router.post("/", async (ctx) => {
  const submission = ZExtensionSubmission.strict().parse(ctx.request.body);
  const document = await createExtension(submission, ctx.state.auth);
  ctx.body = document;
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readExtension(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = document;
  }
});

router.get("/", async (ctx) => {
  const documents = await listExtensions(ctx.state.auth, ctx.state.pagination);
  ctx.body = documents;
});
