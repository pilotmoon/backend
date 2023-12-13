import { Binary } from "mongodb";
import { z } from "zod";
import { TestKey, testKeys } from "../../../test/rolo/setup.js";
import { handleControllerError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import { ZSaneString } from "../../common/saneSchemas.js";
import {
  Auth,
  AuthKind,
  ZAuthInfo,
  ZSettableAuthContext,
  authKinds,
} from "../auth.js";
import { config } from "../config.js";
import { getDb } from "../database.js";
import { deterministic, randomKey } from "../identifiers.js";
import { Pagination, paginate } from "../paginate.js";
import { hashPassword } from "../scrypt.js";

/*** Schemas ***/

// Schema for the parts of the info that must be provided at creation time
export const ZApiKeyInfo = ZSettableAuthContext.extend({
  description: ZSaneString.optional(),
});
type ApiKeyInfo = z.infer<typeof ZApiKeyInfo>;

// Schema for the parts of the info that can be updated later
export const ZApiKeyInfoUpdate = ZApiKeyInfo.partial();
type ApiKeyInfoUpdate = z.infer<typeof ZApiKeyInfoUpdate>;

// Schema for the full API key record to be stored in the database
// This includes the secret key itself, which is stored hashed.
// The secret key is only returned to the client once, when the api key is created.
// The plain text key is never stored in the database. (It is removed from
// the document before it is stored.)
export const ZApiKeySchema = ZApiKeyInfo.merge(ZAuthInfo).merge(
  z.object({
    _id: z.string(),
    object: z.literal("apiKey"),
    key: z.string().optional(),
    hashedKey: z.custom<Binary>((v) => v instanceof Binary),
    created: z.date(),
  }),
);
export type ApiKeySchema = z.infer<typeof ZApiKeySchema>;

/*** Database ***/

const collectionName = "apiKeys";

// helper function to get the database collection for a given key kind
export function dbc(kind: AuthKind) {
  return getDb(kind).collection<ApiKeySchema>(collectionName);
}

// helper to make a dummy context for inserting and reading keys
export function specialContext(kind: AuthKind): Auth {
  return new Auth({
    kind: kind,
    scopes: ["apiKeys:create", "apiKeys:read"],
  });
}

// called at startup to prepare the database
export async function init() {
  for (const kind of authKinds) {
    const collection = dbc(kind);

    // create indexes
    collection.createIndex({ created: 1 });

    // if there are no keys, create a bootstrap key
    const count = await collection.countDocuments();
    if (count === 0) {
      log("No API keys found, creating bootstrap key", kind.blue);
      const settableAuthContext = {
        scopes: ["*"],
        description: "bootstrap key (randomly generated)",
      };
      const document = await createApiKey(
        settableAuthContext,
        specialContext(kind),
      );
      log("Bootstrap key:".black.bgMagenta, document.key);
    }
  }

  // create deterministic test keys
  log("Creating fixed test keys");
  await deterministic(config.BOOTSTRAP_SEED, async () => {
    for (const [name, keyDef] of Object.entries<TestKey>(testKeys)) {
      keyDef.description = `[${name}] ` + keyDef.description;
      await createApiKey(ZApiKeyInfo.parse(keyDef), specialContext("test"), {
        replace: true,
      });
    }
  });
}

/*** C.R.U.D. ***/
// (This stands for Create, Read, Update, Delete. It's a title for this
// section of the file.)

// Create a new API key. Returns the created key, including the secret key
// in cleartext. The `replace` option can be used to allow overwriting an
// existing key with the same id. (This only happens when the key is created
// with a the deterministic key generator, e.g. in tests.)
export async function createApiKey(
  params: ApiKeyInfo,
  auth: Auth,
  { replace = false }: { replace?: boolean } = {},
): Promise<ApiKeySchema> {
  auth.assertAccess(collectionName, undefined, "create");
  const { id, key } = randomKey(auth.kind, "ak");
  const document = {
    _id: id,
    object: "apiKey" as const,
    hashedKey: new Binary(await hashPassword(key)),
    kind: auth.kind,
    created: new Date(),
    ...params,
  };

  try {
    ZApiKeySchema.parse(document);
    if (replace) {
      // delete existing key if it exists
      await dbc(auth.kind).deleteOne({ _id: document._id });
    }
    const result = await dbc(auth.kind).insertOne(document);
    log(`Inserted API key with _id: ${result.insertedId}`);
    return { ...document, key }; // return the key in cleartext since it's a new key
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

// Read an API key. Returns null if the key does not exist. Throws an
// internal server error if the database returns a document that does
// not match the schema.
export async function readApiKey(
  id: string,
  auth: Auth,
): Promise<ApiKeySchema | null> {
  auth.assertAccess(collectionName, id, "read");
  const document = await dbc(auth.kind).findOne({ _id: id });
  if (!document) return null;
  try {
    return ZApiKeySchema.parse(document);
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

// List API keys. This is a paginated list. The default order is by
// creation date, descending. Only the first `limit` keys are returned.
// The `offset` parameter can be used to skip the first `offset` keys.
// The `sortBy` and `sort` parameters can be used to change the sort order.
// The `sort` parameter can be either "1" or "-1" to sort ascending or descending.
// Throws an internal server error if the database returns a document that
// does not match the schema.
export async function listApiKeys(
  pagination: Pagination,
  auth: Auth,
): Promise<ApiKeySchema[]> {
  auth.assertAccess(collectionName, undefined, "read");
  const documents = await paginate(dbc(auth.kind), pagination);
  try {
    return documents.map((document) => ZApiKeySchema.parse(document));
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

// Update an API key. Only the description and scopes can be updated.
// Returns true if the key was updated, false if the key does not exist.
// Accepts a partial update, in which case only the fields that are present
// are updated.
export async function updateApiKey(
  id: string,
  params: ApiKeyInfoUpdate,
  auth: Auth,
): Promise<boolean> {
  auth.assertAccess(collectionName, id, "update");
  try {
    const result = await dbc(auth.kind).findOneAndUpdate(
      { _id: id },
      { $set: params },
      { returnDocument: "after" },
    );
    return !!result.value;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

// Delete an API key. Returns true if the key was deleted, false if the key
// does not exist.
export async function deleteApiKey(id: string, auth: Auth): Promise<boolean> {
  auth.assertAccess(collectionName, id, "delete");
  const result = await dbc(auth.kind).deleteOne({ _id: id });
  return result.deletedCount === 1;
}
