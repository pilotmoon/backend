import { z } from "zod";
import { getDb } from "../database";
import { assertScope, AuthContext } from "../controllers/authController";
import { handleControllerError } from "../errors";
import { KeyKind, keyKinds, randomIdentifier } from "../identifiers";
import { PaginateState } from "../paginate";

/*** DATABASE ***/
function getCollection(kind: KeyKind) {
  const db = getDb(kind);
  return db.collection<ProductRecord>("products");
}
export async function init() {
  for (const kind of keyKinds) {
    const collection = getCollection(kind);
    collection.createIndex({ bundleId: 1, edition: 1 }, { unique: true });
    collection.createIndex({ created: 1 });
  }
}

/*** SCHEMAS ***/
export const ProductInfo = z.object({
  name: z.string(),
  edition: z.enum(["standalone", "mas", "setapp"]),
  bundleId: z.string(),
  aquaticPrimePublicKey: z.string().optional(),
  aquaticPrimePrivateKey: z.string().optional(),
});
export type ProductInfo = z.infer<typeof ProductInfo>;
export const PartialProductInfo = ProductInfo.partial();
export type PartialProductInfo = z.infer<typeof PartialProductInfo>;
export const ProductRecord = ProductInfo.extend({
  _id: z.string(),
  object: z.literal("product"),
  created: z.date(),
});
export type ProductRecord = z.infer<typeof ProductRecord>;

/*** C.R.U.D. ***/
export async function createProduct(
  info: ProductInfo,
  auth: AuthContext,
): Promise<ProductRecord> {
  assertScope("products:create", auth);
  const document = {
    _id: randomIdentifier("pr"),
    object: "product" as const,
    created: new Date(),
    ...info,
  };

  try {
    ProductRecord.parse(document);
    await getCollection(auth.kind).insertOne(document);
    return document;
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

export async function listProducts(
  { limit, offset, order, orderBy }: PaginateState,
  auth: AuthContext,
): Promise<ProductRecord[]> {
  assertScope("products:read", auth);
  const cursor = getCollection(auth.kind).find()
    .sort({ [orderBy]: order })
    .skip(offset)
    .limit(limit);
  const documents = await cursor.toArray();

  try {
    return documents.map((document) => ProductRecord.parse(document));
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

export async function readProduct(
  id: string,
  auth: AuthContext,
): Promise<ProductRecord | null> {
  assertScope("products:read", auth);
  const document = await getCollection(auth.kind).findOne({ _id: id });

  if (!document) return null;
  try {
    return ProductRecord.parse(document);
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

export async function updateProduct(
  id: string,
  info: PartialProductInfo,
  auth: AuthContext,
) {
  assertScope("products:update", auth);
  try {
    const result = await getCollection(auth.kind).findOneAndUpdate(
      { _id: id },
      { $set: info },
      { returnDocument: "after" },
    );
    return (!!result.value);
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

export async function deleteProduct(
  id: string,
  auth: AuthContext,
) {
  assertScope("products:delete", auth);
  const result = await getCollection(auth.kind).deleteOne({ _id: id });
  return result.deletedCount === 1;
}
