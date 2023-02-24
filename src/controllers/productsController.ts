import { z } from "zod";
import { getDb } from "../database";
import { assertScope, AuthContext } from "../controllers/authController";
import { handleControllerError } from "../errors";
import { KeyKind, keyKinds, randomIdentifier } from "../identifiers";
import { PaginateState } from "../middleware/processPagination";
import { ZPortableKeyPair } from "../keyPair";
import { decryptInPlace, encryptInPlace } from "../secrets";
import { omit } from "../omit";
import { ZMongoBinary } from "../binary";
import { Binary } from "mongodb";

/*** Database ***/

// helper function to get the database collection for a given key kind
function dbc(kind: KeyKind) {
  return getDb(kind).collection<ProductRecord>("products");
}

// called at server startup to create indexes
export async function init() {
  for (const kind of keyKinds) {
    const collection = dbc(kind);
    collection.createIndex({ bundleId: 1, edition: 1 }, { unique: true });
    collection.createIndex({ created: 1 });
  }
}

/*** Schemas ***/

export const ZProductInfo = z.object({
  name: z.string(),
  edition: z.enum(["standalone", "mas", "setapp"]),
  bundleId: z.string(),
  aquaticPrimeKeyPair: ZPortableKeyPair.optional(),
});
export const keyPairNames = ["aquaticPrimeKeyPair"] as const;
export type ProductInfo = z.infer<typeof ZProductInfo>;
export const ZPartialProductInfo = ZProductInfo.partial();
export type PartialProductInfo = z.infer<typeof ZPartialProductInfo>;
export const ZProductRecord = ZProductInfo.extend({
  _id: z.string(),
  object: z.literal("product"),
  created: z.date(),
});
export type ProductRecord = z.infer<typeof ZProductRecord>;

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
    ZProductRecord.parse(document);
    encryptInPlace(document, keyPairNames, auth.kind);
    await dbc(auth.kind).insertOne(document);
    decryptInPlace(document, keyPairNames, auth.kind);
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
  const cursor = dbc(auth.kind).find()
    .sort({ [orderBy]: order })
    .skip(offset)
    .limit(limit);
  const documents = await cursor.toArray();

  try {
    return documents.map((document) => {
      decryptInPlace(document, keyPairNames, auth.kind);
      return ZProductRecord.parse(document);
    });
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
  const document = await dbc(auth.kind).findOne({ _id: id });

  if (!document) return null;
  try {
    decryptInPlace(document, keyPairNames, auth.kind);
    return ZProductRecord.parse(document);
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
    encryptInPlace(info, keyPairNames, auth.kind);
    const result = await dbc(auth.kind).findOneAndUpdate(
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
  const result = await dbc(auth.kind).deleteOne({ _id: id });
  return result.deletedCount === 1;
}
