import { z } from "zod";
import { getDb } from "../database";
import { Auth, AuthKind, authKinds } from "../auth";
import { handleControllerError } from "../errors";
import { randomIdentifier, ZIdentifier, ZSaneString } from "../identifiers";
import { PaginateState } from "../middleware/processPagination";
import { ZPortableKeyPair } from "../keyPair";
import { decryptInPlace, encryptInPlace } from "../secrets";
import { ZProductConfig } from "../product";

/*** Database ***/

const collectionName = "registries";
// helper function to get the database collection for a given key kind
function dbc(kind: AuthKind) {
  return getDb(kind).collection<RegistrySchema>(collectionName);
}

// called at server startup to create indexes
export async function init() {
  for (const kind of authKinds) {
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

// schema for a generic record
export const ZRecord = z.object({
  object: z.enum(["record"]),
  record: z.record(z.string(), z.unknown()),
});

// types that can be stored as an object in the registry
export const ZObject = z.discriminatedUnion("object", [
  ZRecord,
  ZProductConfig,
  ZPortableKeyPair,
]);
export type RegistryObject = z.infer<typeof ZObject>;

// a function to redact secrets by removing the secret data.
// a redated flag is added.
export function redact(info: RegistryInfo) {
  if (!info.objects) return info;
  const redactedObjects = Object.fromEntries(
    Object.entries(info.objects).map(([key, obj]) => {
      return [key, { object: obj.object, redacted: true }];
    }),
  );
  return { ...info, objects: redactedObjects };
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
export const ZRegistrySchema = ZRegistryInfo.extend({
  _id: z.string(),
  object: z.literal("registry"),
  created: z.date(),
});
export type RegistrySchema = z.infer<typeof ZRegistrySchema>;

/*** C.R.U.D. Operations ***/

// Create a new registry.
export async function createRegistry(
  info: RegistryInfo,
  auth: Auth,
): Promise<RegistrySchema> {
  auth.assertAccess(collectionName, undefined, "create");
  const document: RegistrySchema = {
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
  auth: Auth,
): Promise<RegistrySchema[]> {
  auth.assertAccess(collectionName, undefined, "read");
  const cursor = dbc(auth.kind).find()
    .sort({ [orderBy]: order })
    .skip(offset)
    .limit(limit);
  const documents = await cursor.toArray();

  try {
    return documents.map((document) => {
      decryptInPlace(document.objects, auth.kind);
      return ZRegistrySchema.parse(document);
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
  auth: Auth,
): Promise<RegistrySchema | null> {
  auth.assertAccess(collectionName, id, "read");
  const document = await dbc(auth.kind).findOne(
    { $or: [{ _id: id }, { identifiers: id }] },
  );

  if (!document) return null;
  try {
    decryptInPlace(document.objects, auth.kind);
    return ZRegistrySchema.parse(document);
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
  auth: Auth,
) {
  auth.assertAccess(collectionName, id, "update");
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
  auth: Auth,
) {
  auth.assertAccess(collectionName, id, "delete");
  const result = await dbc(auth.kind).deleteOne(
    { $or: [{ _id: id }, { identifiers: id }] },
  );
  return result.deletedCount === 1;
}

// Get an object from a registry by its canonical ID or one of its other identifiers.
// Returns null if the registry or object does not exist.
export async function getRegistryObject(
  productId: string,
  objectName: string,
  auth: Auth,
): Promise<RegistryObject | null> {
  const registry = await readRegistry(productId, auth);
  if (!registry) return null;
  const object = registry.objects?.[objectName];
  if (!object) return null;
  return object;
}

// get object for internal application use
export async function getRegistryObjectInternal(
  identifier: string,
  object: string,
  kind: AuthKind,
): Promise<Record<string, unknown> | null> {
  return await getRegistryObject(
    identifier,
    object,
    new Auth({
      scopes: ["*"],
      kind: kind,
    }),
  );
}
