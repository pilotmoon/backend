import { assertScope, hasScope } from "../authController";
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
    ...suppliedProductData,
  };

  // insert into database
  const collection = getCollection(authContext.kind);
  try {
    const result = await collection.insertOne(ProductRecord.parse(document));
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

router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const authContext = ctx.state.auth;
  assertScope("products:read", authContext);
  const id = ctx.params.id;
  const document = await getCollection(authContext.kind).findOne({ _id: id });
  if (!document) {
    throw new ApiError(404, `Product '${id}' not found`);
  }
  ctx.body = ProductRecord.parse(document);
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
  } else {
    throw new ApiError(404, `Product '${id}' not found`);
  }
});

router.delete(matchId.pattern, async (ctx) => {
  const authContext = ctx.state.auth;
  assertScope("products:delete", authContext);
  const id = ctx.params.id;
  const result = await getCollection(authContext.kind).deleteOne({ _id: id });
  return result.deletedCount === 1;
});
