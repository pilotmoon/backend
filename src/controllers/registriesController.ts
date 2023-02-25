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

// Registries store arbitrary objects, such as key pairs, secrets, etc.
//
// The registry itself has a description, and a list of identifiers.
// The registry can be looked up by any of the identifiers. Identifiers
// must be unique across all registries.
//
// All objects stored in the registry are encrypted with the application's
// encryption key.
//
// Upon retreival, the objects are decrypted and returned to the client.
// By default the secret data is redacted, but the client can request
// the secret data to be returned.
//
// Which parts of the object are secret is determined by the object's
// type. For example, a key pair object has a public key and a private
// key. The public key is not secret, but the private key is.

// schema for a generic record, secret or not
export const ZRecord = z.object({
  object: z.literal("record"),
  secret: z.boolean(),
  record: z.record(z.string(), z.unknown()),
});

// types that can be stored as an object in the registry
export const ZObject = z.discriminatedUnion("object", [
  ZRecord,
  ZPortableKeyPair,
]);

// a function to redact secrets by removing the secret data.
// a redated flag is added.
export function redact(info: RegistryInfoUpdate) {
  const objects = { ...info.objects };
  Object.values(objects).forEach(redactObjectInPlace);
  return { ...info, objects };
}
export function redactObjectInPlace(object: z.infer<typeof ZObject>) {
  switch (object.object) {
    case "keyPair":
      (object as any).privateKey = undefined;
      (object as any).redacted = true;
      break;
    case "record":
      if (object.secret) {
        (object as any).record = undefined;
        (object as any).redacted = true;
      }
      break;
  }
}

// schema for the parts of the info that must be provided at creation time
export const ZRegistryInfo = z.object({
  description: ZSaneString,
  identifiers: z.array(ZIdentifier).nonempty(),
  objects: z.record(ZSaneString, ZObject).optional(),
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

// Create a new registry.
export async function createRegistry(
  info: RegistryInfo,
  auth: AuthContext,
): Promise<RegistryRecord> {
  assertScope("registries:create", auth);
  const document: RegistryRecord = {
    _id: randomIdentifier("reg"),
    object: "registry" as const,
    created: new Date(),
    ...info,
  };

  try {
    encryptInPlace(document.objects, auth.kind);
    await dbc(auth.kind).insertOne(document);
    decryptInPlace(document.objects, auth.kind);
    return document;
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

// List registries.
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
      decryptInPlace(document.objects, auth.kind);
      return ZRegistryRecord.parse(document);
    });
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

// Read a registry by its canonical ID or one of its other identifiers.
// Returns null if the registry does not exist.
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
    decryptInPlace(document.objects, auth.kind);
    return ZRegistryRecord.parse(document);
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

// Update a registry by its canonical ID or one of its other identifiers.
// Returns true if the registry was updated, false if it was not found.
export async function updateRegistry(
  id: string,
  info: RegistryInfoUpdate,
  auth: AuthContext,
) {
  assertScope("registries:update", auth);
  try {
    encryptInPlace(info.objects, auth.kind);
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

// Delete a registry by its canonical ID or one of its other identifiers.
// Returns true if the registry was deleted, false if it was not found.
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
