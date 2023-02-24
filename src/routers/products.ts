import { makeRouter } from "../koa";
import { randomUUID } from "node:crypto";
import { makeIdentifierPattern } from "../identifiers";
import {
  createProduct,
  deleteProduct,
  listProducts,
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

// create new product
router.post("/", async (ctx) => {
  const suppliedData = ZProductInfo.parse(ctx.request.body);
  const document = await createProduct(suppliedData, ctx.state.auth);
  ctx.body = document;
  ctx.status = 201;
  ctx.set("Location", ctx.location(matchId.uuid, { id: document._id }));
});

// list products
router.get("/", async (ctx) => {
  const documents = await listProducts(ctx.state.paginate, ctx.state.auth);
  ctx.body = documents;
});

router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readProduct(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = document;
  }
});

router.patch(matchId.uuid, matchId.pattern, async (ctx) => {
  const suppliedData = ZPartialProductInfo.parse(ctx.request.body);
  if (await updateProduct(ctx.params.id, suppliedData, ctx.state.auth)) {
    ctx.status = 204;
  }
});

router.delete(matchId.uuid, matchId.pattern, async (ctx) => {
  if (await deleteProduct(ctx.params.id, ctx.state.auth)) {
    ctx.status = 204;
  }
});
