import { makeRouter } from "../koaWrapper";
import { randomUUID } from "node:crypto";
import { genericIdPattern, makeIdentifierPattern } from "../identifiers";
import {
  createRegistry,
  deleteRegistry,
  listRegistries,
  readRegistry,
  sanitize,
  updateRegistry,
  ZRegistryInfo,
  ZRegistryInfoUpdate,
  ZSecret,
} from "../controllers/registriesController";
import { assertScope } from "../controllers/authController";

export const router = makeRouter({ prefix: "/registries" });
const matchId = {
  pattern: makeIdentifierPattern("id", "pr"),
  uuid: randomUUID(),
};

// create new registry
router.post("/", async (ctx) => {
  const suppliedData = ZRegistryInfo.strict().parse(ctx.request.body);
  const document = await createRegistry(suppliedData, ctx.state.auth);
  ctx.body = sanitize(document);
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

// list registries
router.get("/", async (ctx) => {
  const documents = await listRegistries(ctx.state.paginate, ctx.state.auth);
  ctx.body = documents.map(sanitize);
});

// read a registry
router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readRegistry(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = sanitize(document);
  }
});

// update a registry
router.patch(matchId.uuid, matchId.pattern, async (ctx) => {
  const suppliedData = ZRegistryInfoUpdate.strict().parse(ctx.request.body);
  if (await updateRegistry(ctx.params.id, suppliedData, ctx.state.auth)) {
    ctx.status = 204;
  }
});

// delete a registry
router.delete(matchId.uuid, matchId.pattern, async (ctx) => {
  if (await deleteRegistry(ctx.params.id, ctx.state.auth)) {
    ctx.status = 204;
  }
});

// add or update a named secret using a dedicated url
router.put(matchId.pattern + "/secrets/:secretId", async (ctx) => {
  const suppliedSecret = ZSecret.parse(ctx.request.body);

  // get current document
  const document = await readRegistry(ctx.params.id, ctx.state.auth);
  if (!document) return;

  // insert the new secret
  document.secrets = {
    ...document.secrets,
    [ctx.params.secretId]: suppliedSecret,
  };

  // update the document
  if (await updateRegistry(ctx.params.id, document, ctx.state.auth)) {
    ctx.status = 204;
  }
});

// read a named secret using a dedicated url
router.get(matchId.pattern + "/secrets/:secretId", async (ctx) => {
  assertScope("secrets:read", ctx.state.auth); // special scope for unredacted secrets

  const document = await readRegistry(ctx.params.id, ctx.state.auth);
  if (!document?.secrets) return;

  const secret = document.secrets[ctx.params.secretId];
  if (secret) {
    ctx.body = secret; // note: no sanitization
  }
});

// read a registry using one of its identifiers, using `byIdentifier` url
router.get(`/byIdentifier/:identifier(${genericIdPattern})`, async (ctx) => {
  const document = await readRegistry(ctx.params.identifier, ctx.state.auth);
  if (document) {
    ctx.body = sanitize(document);
  }
});
