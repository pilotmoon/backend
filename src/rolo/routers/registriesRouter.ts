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
import { makeGenericIdPattern } from "../identifiers.js";
import { makeRouter } from "../koaWrapper.js";

export const router = makeRouter({ prefix: "/registries" });
const matchId = {
  pattern: makeGenericIdPattern("id"),
  uuid: randomUUID(),
};

// create new registry
router.post("/", async (ctx) => {
  const suppliedData = ZRegistryInfo.strict().parse(ctx.request.body);
  const document = await createRegistry(suppliedData, ctx.state.auth);
  ctx.body = redact(document, ctx.query);
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

// list registries
router.get("/", async (ctx) => {
  const documents = await listRegistries(ctx.state.pagination, ctx.state.auth);
  ctx.body = documents.map((info) => redact(info, ctx.query));
});

// read a registry
router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readRegistry(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = redact(document, ctx.query);
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

//delete a registry object
router.delete(`${matchId.pattern}/objects/:objectId`, async (ctx) => {
  const auth = ctx.state.auth;
  const id = ctx.params.id;
  const objectId = ctx.params.objectId;

  // get current document and check if the object exists
  const document = await readRegistry(id, auth);
  if (!document?.objects?.[objectId]) {
    return;
  }

  // delete the object
  delete document.objects[objectId];

  // update the document
  if (await updateRegistry(id, document, auth)) {
    ctx.status = 204;
  }
});

// add or update a named object using a dedicated url
router.put(`${matchId.pattern}/objects/:objectId`, async (ctx) => {
  // if "wrap=record" supplied in query param, wrap the body
  const wrap = ctx.query.wrap;
  let body = ctx.request.body;
  if (wrap === "record") {
    body = { object: "record", record: body };
  }

  const suppliedObject = ZObject.parse(body);
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
