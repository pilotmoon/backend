import { z } from "zod";
import { getDb } from "../database";
import { assertScope, AuthContext } from "../controllers/authController";
import { handleControllerError } from "../errors";
import {
  genericIdRegex,
  KeyKind,
  keyKinds,
  randomIdentifier,
} from "../identifiers";
import { PaginateState } from "../middleware/processPagination";
import { ZPortableKeyPair } from "../keyPair";
import { decryptInPlace, encryptInPlace } from "../secrets";

/*** Database ***/

// helper function to get the database collection for a given key kind
function dbc(kind: KeyKind) {
  return getDb(kind).collection<ProductRecord>("products");
}

// called at server startup to create indexes
export async function init() {
  for (const kind of keyKinds) {
    const collection = dbc(kind);
    collection.createIndex({ identifiers: 1 }, { unique: true });
    collection.createIndex({ created: 1 });
  }
}

/*** Schemas ***/

// a type to store secrets indexed by name
export const ZSecret = z.discriminatedUnion("object", [
  ZPortableKeyPair,
]);
export type Secret = z.infer<typeof ZSecret>;

// a function to sanitize secrets by removing private keys
// and adding a "redacted" flag
export function sanitize(info: ProductInfoUpdate) {
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

// schema for the legal identifiers of a product
const ZIdentifier = z.string().regex(genericIdRegex).max(100);

// schema for the parts of the info that can be provided at creation time
export const ZProductInfo = z.object({
  name: z.string().min(1).max(100),
  identifiers: z.array(ZIdentifier)
    .nonempty(),
  secrets: z.record(z.string().min(1).max(100), ZSecret).optional(),
});
export type ProductInfo = z.infer<typeof ZProductInfo>;

// schema for the parts of the info that can be updated later
export const ZProductInfoUpdate = ZProductInfo.partial();
export type ProductInfoUpdate = z.infer<typeof ZProductInfoUpdate>;

// schema for the full product record stored in database
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
    encryptInPlace(document.secrets, auth.kind);
    await dbc(auth.kind).insertOne(document);
    decryptInPlace(document.secrets, auth.kind);
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
      decryptInPlace(document.secrets, auth.kind);
      return ZProductRecord.parse(document);
    });
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

// id can be any identifier, not just the _id
export async function readProduct(
  id: string,
  auth: AuthContext,
): Promise<ProductRecord | null> {
  assertScope("products:read", auth);
  const document = await dbc(auth.kind).findOne(
    { $or: [{ _id: id }, { identifiers: id }] },
  );

  if (!document) return null;
  try {
    decryptInPlace(document.secrets, auth.kind);
    return ZProductRecord.parse(document);
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

export async function updateProduct(
  id: string,
  info: ProductInfoUpdate,
  auth: AuthContext,
) {
  assertScope("products:update", auth);
  try {
    encryptInPlace(info.secrets, auth.kind);
    const result = await dbc(auth.kind).findOneAndUpdate(
      { $or: [{ _id: id }, { identifiers: id }] },
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
  const result = await dbc(auth.kind).deleteOne(
    { $or: [{ _id: id }, { identifiers: id }] },
  );
  return result.deletedCount === 1;
}
