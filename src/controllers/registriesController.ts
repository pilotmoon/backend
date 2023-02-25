import { z } from "zod";
import { getDb } from "../database";
import { assertScope, AuthContext } from "./authController";
import { handleControllerError } from "../errors";
import {
  genericIdRegex,
  KeyKind,
  keyKinds,
  randomIdentifier,
  ZIdentifier,
  ZSaneString,
} from "../identifiers";
import { PaginateState } from "../middleware/processPagination";
import { ZPortableKeyPair } from "../keyPair";
import { decryptInPlace, encryptInPlace } from "../secrets";

/*** Database ***/

// helper function to get the database collection for a given key kind
function dbc(kind: KeyKind) {
  return getDb(kind).collection<RegistryRecord>("registries");
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
export function sanitize(info: RegistryInfoUpdate) {
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

// schema for the parts of the info that must be provided at creation time
export const ZRegistryInfo = z.object({
  description: ZSaneString,
  identifiers: z.array(ZIdentifier).nonempty(),
  secrets: z.record(ZSaneString, ZSecret).optional(),
});
export type RegistryInfo = z.infer<typeof ZRegistryInfo>;

// schema for the parts of the info that can be updated later
export const ZRegistryInfoUpdate = ZRegistryInfo.partial();
export type RegistryInfoUpdate = z.infer<typeof ZRegistryInfoUpdate>;

// schema for the full registry record stored in database
export const ZRegistryRecord = ZRegistryInfo.extend({
  _id: z.string(),
  object: z.literal("registry"),
  created: z.date(),
});
export type RegistryRecord = z.infer<typeof ZRegistryRecord>;

/*** C.R.U.D. Operations ***/

// Create a new registry. The auth context must have the "registries:create" scope.
// The registry info may contain secrets, which will be encrypted in the database.
// The registry info must contain an array of client-provided identifiers, which
// will be used to look up the registry later. The identifiers must be unique
// across all registries. At least one identifier must be provided. A canonical
// ID will also be generated for the registry, with the "reg" prefix, which will be
// the primary identifier used to look up the registry.
export async function createRegistry(
  info: RegistryInfo,
  auth: AuthContext,
): Promise<RegistryRecord> {
  assertScope("registries:create", auth);
  const document = {
    _id: randomIdentifier("reg"),
    object: "registry" as const,
    created: new Date(),
    ...info,
  };

  try {
    ZRegistryRecord.parse(document);
    encryptInPlace(document.secrets, auth.kind);
    await dbc(auth.kind).insertOne(document);
    decryptInPlace(document.secrets, auth.kind);
    return document;
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

// List registries. The auth context must have the "registries:read" scope.
// The paginate state must contain the limit and offset for the query.
export async function listRegistries(
  { limit, offset, order, orderBy }: PaginateState,
  auth: AuthContext,
): Promise<RegistryRecord[]> {
  assertScope("registries:list", auth);
  const cursor = dbc(auth.kind).find()
    .sort({ [orderBy]: order })
    .skip(offset)
    .limit(limit);
  const documents = await cursor.toArray();

  try {
    return documents.map((document) => {
      decryptInPlace(document.secrets, auth.kind);
      return ZRegistryRecord.parse(document);
    });
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

// Read a registry by its canonical ID or one of its other identifiers. The auth
// context must have the "registries:read" scope.
export async function readRegistry(
  id: string,
  auth: AuthContext,
): Promise<RegistryRecord | null> {
  assertScope("registries:read", auth);
  const document = await dbc(auth.kind).findOne(
    { $or: [{ _id: id }, { identifiers: id }] },
  );

  if (!document) return null;
  try {
    decryptInPlace(document.secrets, auth.kind);
    return ZRegistryRecord.parse(document);
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

// Update a registry by its canonical ID or one of its other identifiers. The auth
// context must have the "registries:update" scope. The registry info may contain
// secrets, which will be encrypted in the database.
export async function updateRegistry(
  id: string,
  info: RegistryInfoUpdate,
  auth: AuthContext,
) {
  assertScope("registries:update", auth);
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

// Delete a registry by its canonical ID or one of its other identifiers. The auth
// context must have the "registries:delete" scope. Returns true if the registry was
// deleted, false if it was not found.
export async function deleteRegistry(
  id: string,
  auth: AuthContext,
) {
  assertScope("registries:delete", auth);
  const result = await dbc(auth.kind).deleteOne(
    { $or: [{ _id: id }, { identifiers: id }] },
  );
  return result.deletedCount === 1;
}
