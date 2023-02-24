import { makeRouter } from "../koaWrapper";
import { randomUUID } from "node:crypto";
import { makeIdentifierPattern } from "../identifiers";
import {
  createProduct,
  deleteProduct,
  listProducts,
  PartialProductInfo,
  readProduct,
  updateProduct,
  ZPartialProductInfo,
  ZProductInfo,
} from "../controllers/productsController";

export const router = makeRouter({ prefix: "/products" });
const matchId = {
  pattern: makeIdentifierPattern("id", "pr"),
  uuid: randomUUID(),
};

function sanitize(info: PartialProductInfo) {
  const secrets = info.secrets;
  if (secrets) {
    for (const [key, value] of Object.entries(secrets)) {
      if (value.object == "keyPair") {
        (secrets[key] as any).privateKey = undefined;
        (secrets[key] as any).redacted = true;
      }
    }
  }
  return { ...info, secrets };
}

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

router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readProduct(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = sanitize(document);
  }
});

router.patch(matchId.uuid, matchId.pattern, async (ctx) => {
  const suppliedData = ZPartialProductInfo.strict().parse(ctx.request.body);
  if (await updateProduct(ctx.params.id, suppliedData, ctx.state.auth)) {
    ctx.status = 204;
  }
});

router.delete(matchId.uuid, matchId.pattern, async (ctx) => {
  if (await deleteProduct(ctx.params.id, ctx.state.auth)) {
    ctx.status = 204;
  }
});
