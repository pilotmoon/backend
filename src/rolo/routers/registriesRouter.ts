import { randomUUID } from "node:crypto";
import {
  ZObject,
  ZRegistryInfo,
  ZRegistryInfoUpdate,
  createRegistry,
  deleteRegistry,
  getRegistryObject,
  listRegistries,
  readRegistry,
  redact,
  updateRegistry,
} from "../controllers/registriesController.js";
import { makeGenericIdPattern, makeIdentifierPattern } from "../identifiers.js";
import { makeRouter } from "../koaWrapper.js";

export const router = makeRouter({ prefix: "/registries" });
const matchId = {
  pattern: makeIdentifierPattern("id", "reg"),
  uuid: randomUUID(),
};

// create new registry
router.post("/", async (ctx) => {
  const suppliedData = ZRegistryInfo.strict().parse(ctx.request.body);
  const document = await createRegistry(suppliedData, ctx.state.auth);
  ctx.body = redact(document);
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

// list registries
router.get("/", async (ctx) => {
  const documents = await listRegistries(ctx.state.pagination, ctx.state.auth);
  ctx.body = documents.map(redact);
});

// read a registry
router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readRegistry(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = redact(document);
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

// add or update a named object using a dedicated url
router.put(`${matchId.pattern}/objects/:objectId`, async (ctx) => {
  const suppliedObject = ZObject.parse(ctx.request.body);
  const auth = ctx.state.auth;
  const id = ctx.params.id;
  const objectId = ctx.params.objectId;

  // get current document
  const document = await readRegistry(id, auth);
  if (!document) return;

  // insert the new secret
  document.objects = {
    ...document.objects,
    [objectId]: suppliedObject,
  };

  // update the document
  if (await updateRegistry(id, document, auth)) {
    ctx.status = 204;
  }
});

// read a named objects using a dedicated url
router.get(`${matchId.pattern}/objects/:objectId`, async (ctx) => {
  const document = await getRegistryObject(
    ctx.params.id,
    ctx.params.objectId,
    ctx.state.auth,
  );
  if (document) {
    ctx.body = document;
  }
});

// read a registry using one of its identifiers, using `byIdentifier` url
router.get(
  `/byIdentifier${makeGenericIdPattern("identifier")}`,
  async (ctx) => {
    const document = await readRegistry(ctx.params.identifier, ctx.state.auth);
    if (document) {
      ctx.body = redact(document);
    }
  },
);
