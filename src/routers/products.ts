import { makeRouter } from "../koaWrapper";
import { randomUUID } from "node:crypto";
import { makeGenericIdPattern, makeIdentifierPattern } from "../identifiers";
import {
  createProduct,
  deleteProduct,
  listProducts,
  readProduct,
  sanitize,
  updateProduct,
  ZPartialProductInfo,
  ZProductInfo,
  ZSecret,
} from "../controllers/productsController";
import { assertScope } from "../controllers/authController";

export const router = makeRouter({ prefix: "/products" });
const matchId = {
  pattern: makeIdentifierPattern("id", "pr"),
  uuid: randomUUID(),
};

// create new product
router.post("/", async (ctx) => {
  const suppliedData = ZProductInfo.strict().parse(ctx.request.body);
  const document = await createProduct(suppliedData, ctx.state.auth);
  ctx.body = sanitize(document);
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

// list products
router.get("/", async (ctx) => {
  const documents = await listProducts(ctx.state.paginate, ctx.state.auth);
  ctx.body = documents.map(sanitize);
});

// read a product
router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readProduct(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = sanitize(document);
  }
});

// update a product
router.patch(matchId.uuid, matchId.pattern, async (ctx) => {
  const suppliedData = ZPartialProductInfo.strict().parse(ctx.request.body);
  if (await updateProduct(ctx.params.id, suppliedData, ctx.state.auth)) {
    ctx.status = 204;
  }
});

// delete a product
router.delete(matchId.uuid, matchId.pattern, async (ctx) => {
  if (await deleteProduct(ctx.params.id, ctx.state.auth)) {
    ctx.status = 204;
  }
});

// add or update a named secret using a dedicated url
router.put(matchId.pattern + "/secrets/:secretId", async (ctx) => {
  const suppliedSecret = ZSecret.parse(ctx.request.body);

  // get current document
  const document = await readProduct(ctx.params.id, ctx.state.auth);
  if (!document) return;

  // insert the new secret
  document.secrets = {
    ...document.secrets,
    [ctx.params.secretId]: suppliedSecret,
  };

  // update the document
  if (await updateProduct(ctx.params.id, document, ctx.state.auth)) {
    ctx.status = 204;
  }
});

// read a named secret using a dedicated url
router.get(matchId.pattern + "/secrets/:secretId", async (ctx) => {
  assertScope("secrets:read", ctx.state.auth); // special scope for unredacted secrets

  const document = await readProduct(ctx.params.id, ctx.state.auth);
  if (!document?.secrets) return;

  const secret = document.secrets[ctx.params.secretId];
  if (secret) {
    ctx.body = secret; // note: no sanitization
  }
});

// read a product using one of its identifiers, using `byIdentifier` url
router.get("/byIdentifier/:identifier", async (ctx) => {
  const document = await readProduct(ctx.params.identifier, ctx.state.auth);
  if (document) {
    ctx.body = sanitize(document);
  }
});
