import { assertScope, hasScope } from "../controllers/authController";
import { makeRouter } from "../koa";
import { getDb } from "../database";
import { MongoServerError } from "mongodb";
import {
  KeyKind,
  keyKinds,
  makeIdentifierPattern,
  randomIdentifier,
} from "../identifiers";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { ApiError } from "../errors";
import { log } from "../logger";

function getCollection(kind: KeyKind) {
  const db = getDb(kind);
  return db.collection<ProductRecord>("products");
}

// called at startup to prepare the database
export async function init() {
  for (const kind of keyKinds) {
    // create unique compound index on bundleId and edition
    const collection = getCollection(kind);
    collection.createIndex({ bundleId: 1, edition: 1 }, { unique: true });
    collection.createIndex({ created: 1 });
  }
}

export const router = makeRouter({ prefix: "/products" });
const matchId = {
  pattern: makeIdentifierPattern("id", "pr"),
  uuid: randomUUID(),
};

const SettableProductRecord = z.object({
  name: z.string(),
  edition: z.enum(["standalone", "mas", "setapp"]),
  bundleId: z.string(),
  aquaticPrimePublicKey: z.string().optional(),
  aquaticPrimePrivateKey: z.string().optional(),
});
type SettableProductRecord = z.infer<typeof SettableProductRecord>;
const PartialProductRecord = SettableProductRecord.partial();
type PartialProductRecord = z.infer<typeof PartialProductRecord>;
const ProductRecord = SettableProductRecord.extend({
  _id: z.string(),
  object: z.literal("product"),
  created: z.date(),
});
export type ProductRecord = z.infer<typeof ProductRecord>;

// create new product
router.post("/", async (ctx) => {
  const authContext = ctx.state.auth;
  assertScope("products:create", authContext);

  // parse request body
  const suppliedProductData = SettableProductRecord.parse(ctx.request.body);
  const document = {
    _id: randomIdentifier("pr"),
    object: "product" as const,
    created: new Date(),
    ...suppliedProductData,
  };
  ProductRecord.parse(document);

  // insert into database
  const collection = getCollection(authContext.kind);
  try {
    const result = await collection.insertOne(document);
    ctx.body = document;
    ctx.status = 201;
    ctx.set("Location", ctx.location(matchId.uuid, { id: document._id }));
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new ApiError(409, "Conflict with existing product");
    } else {
      throw error;
    }
  }
});

// list products
router.get("/", async (ctx) => {
  const authContext = ctx.state.auth;
  const { limit, offset, order, orderBy } = ctx.state.paginate;
  assertScope("products:read", authContext);
  const cursor = getCollection(authContext.kind).find()
    .sort({ [orderBy]: order })
    .skip(offset)
    .limit(limit);
  const documents = await cursor.toArray();
  try {
    ctx.body = documents.map((document) => ProductRecord.parse(document));
  } catch (error: any) {
    throw new ApiError(500, "Error parsing database result: " + error?.message);
  }
});

router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const authContext = ctx.state.auth;
  assertScope("products:read", authContext);
  const id = ctx.params.id;
  const document = await getCollection(authContext.kind).findOne({ _id: id });
  if (document) {
    ctx.body = ProductRecord.parse(document);
  }
});

router.patch(matchId.pattern, async (ctx) => {
  const authContext = ctx.state.auth;
  assertScope("products:update", authContext);
  const id = ctx.params.id;
  const suppliedProductData = PartialProductRecord.parse(ctx.request.body);
  let result;
  try {
    result = await getCollection(authContext.kind).findOneAndUpdate({
      _id: id,
    }, {
      $set: suppliedProductData,
    }, {
      returnDocument: "after",
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new ApiError(409, "Conflict with existing product");
    }
    throw error;
  }

  const document = ProductRecord.parse(result.value);
  if (typeof document === "object" && document !== null) {
    if (hasScope("products:read", authContext)) {
      ctx.body = document;
    } else {
      ctx.status = 204;
    }
  }
});

router.delete(matchId.pattern, async (ctx) => {
  log("delete product", { id: ctx.params.id });
  const authContext = ctx.state.auth;
  assertScope("products:delete", authContext);
  const id = ctx.params.id;
  const result = await getCollection(authContext.kind).deleteOne({ _id: id });
  if (result.deletedCount === 1) {
    ctx.status = 204;
  }
});
