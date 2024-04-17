import { randomUUID } from "node:crypto";
import { makeIdentifierPattern } from "../identifiers.js";
import { makeRouter } from "../koaWrapper.js";
import {
  ZExtensionSubmission,
  createExtensionSubmission,
  readExtensionSubmission,
} from "../controllers/extensionsController.js";

export const router = makeRouter({ prefix: "/extensionSubmissions" });
const matchId = {
  pattern: makeIdentifierPattern("id", "xs"),
  uuid: randomUUID(),
};

router.post("/", async (ctx) => {
  const submission = ZExtensionSubmission.strict().parse(ctx.request.body);
  const document = await createExtensionSubmission(submission, ctx.state.auth);
  ctx.body = document;
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readExtensionSubmission(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = document;
  }
});
