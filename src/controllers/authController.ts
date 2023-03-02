import {
  collectionNames,
  deterministic,
  randomKey,
  ZSaneString,
} from "../identifiers";
import { z } from "zod";
import { getDb } from "../database";
import { Binary } from "mongodb";
import { ApiError, handleControllerError } from "../errors";
import { log } from "../logger";
import { KeyKind, keyKinds } from "../identifiers";
import { hashPassword } from "../scrypt";
import { TestKey, testKeys } from "../../test/api/setup";
import { PaginateState } from "../middleware/processPagination";

/*** Schemas ***/

// Schema for the parts of the info that must be provided at creation time
export const ZAuthContextInfo = z.object({
  scopes: z.array(z.string()),
  expires: z.date().optional(),
  description: ZSaneString,
});
type AuthContextInfo = z.infer<typeof ZAuthContextInfo>;

// Schema for the parts of the info that can be updated later
export const ZAuthContextInfoUpdate = ZAuthContextInfo.partial();
type AuthContextInfoUpdate = z.infer<typeof ZAuthContextInfoUpdate>;

// Schema for the full info of a key, including the key kind (test or live)
// which is derived from the auth context used to create the key.
// It is not possible to create a test key with a live auth context,
// or vice versa.
export const ZAuthContext = ZAuthContextInfo.extend({
  kind: z.enum(keyKinds),
});
export type AuthContext = z.infer<typeof ZAuthContext>;

// Schema for the full API key record to be stored in the database
// This includes the secret key itself, which is stored hashed.
// The secret key is only returned to the client once, when the api key is created.
// The plain text key is never stored in the database. (It is removed from
// the document before it is stored.)
export const ZApiKeySchema = ZAuthContext.extend({
  _id: z.string(),
  object: z.literal("apiKey"),
  key: z.string().optional(),
  hashedKey: z.custom<Binary>((v) => v instanceof Binary),
  created: z.date(),
});
export type ApiKeySchema = z.infer<typeof ZApiKeySchema>;

// auth class extends AuthContext by adding functions to validate access
export class Auth implements AuthContext {
  scopes: string[];
  kind: KeyKind;
  expires?: Date;
  description: string;

  constructor(public readonly authContext: AuthContext) {
    this.scopes = authContext.scopes;
    this.kind = authContext.kind;
    this.description = authContext.description;
    this.expires = authContext.expires;
    this.assertValid();
  }

  assertValid() {
    if (!keyKinds.includes(this.kind)) {
      throw new ApiError(500, "Invalid key kind");
    }
    if (this.expires && this.expires < new Date()) {
      throw new ApiError(401, "Expired token or key");
    }
    if (!this.scopes.length) {
      throw new ApiError(403, "Insufficient scope");
    }
  }

  // check whether the context is authorized to perform the given action with the given resource.
  assertAccess(
    collectionName: typeof collectionNames[number],
    resource: string | undefined,
    action: "create" | "read" | "update" | "delete",
  ) {
    const acceptedScopes = [
      `${collectionName}:${action}`,
      `${collectionName}:*`,
      `*`,
    ];
    if (resource) {
      acceptedScopes.push(
        `${collectionName}/${resource}:${action}`,
        `${collectionName}/${resource}:*`,
      );
    }
    if (!this.scopes.some((scope) => acceptedScopes.includes(scope))) {
      throw new ApiError(403, "Insufficient scope");
    }
  }
}

/*** Database ***/

const collectionName = "apiKeys";

// helper function to get the database collection for a given key kind
export function dbc(kind: KeyKind) {
  return getDb(kind).collection<ApiKeySchema>(collectionName);
}

// helper to make a dummy context for inserting and reading keys
export function specialContext(kind: KeyKind): Auth {
  return new Auth({
    kind: kind,
    scopes: ["apiKeys:create", "apiKeys:read"],
    description: "",
  });
}

// called at startup to prepare the database
export async function init() {
  for (const kind of keyKinds) {
    const collection = dbc(kind);

    // create indexes
    collection.createIndex({ created: 1 });

    // if there are no keys, create a bootstrap key
    const count = await collection.countDocuments();
    if (count == 0) {
      log("No API keys found, creating bootstrap key", kind.blue);
      const settableAuthContext = {
        scopes: ["*"],
        description: "bootstrap key (randomly generated)",
      };
      const document = await createApiKey(
        settableAuthContext,
        specialContext(kind),
      );
      console.log("Bootstrap key:".bgMagenta, document.key);
    }
  }

  // create deterministic test keys
  console.log("Creating fixed test keys");
  await deterministic(async () => {
    for (
      const [name, keyDef] of Object.entries<TestKey>(testKeys)
    ) {
      keyDef.description = `[${name}] ` + keyDef.description;
      await createApiKey(
        ZAuthContextInfo.parse(keyDef),
        specialContext("test"),
        { replace: true },
      );
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
  params: AuthContextInfo,
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
    if (replace) { // delete existing key if it exists
      await dbc(auth.kind).deleteOne({ _id: document._id });
    }
    const result = await dbc(auth.kind).insertOne(document);
    log(`Inserted API key with _id: ${result.insertedId}`);
    return { ...document, key }; // return the key in cleartext since it's a new key
  } catch (error) {
    handleControllerError(error);
    throw (error);
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
    throw (error);
  }
}

// List API keys. This is a paginated list. The default order is by
// creation date, descending. Only the first `limit` keys are returned.
// The `offset` parameter can be used to skip the first `offset` keys.
// The `orderBy` and `order` parameters can be used to change the sort order.
// The `order` parameter can be either "1" or "-1" to sort ascending or descending.
// Throws an internal server error if the database returns a document that
// does not match the schema.
export async function listApiKeys(
  { limit, offset, order, orderBy }: PaginateState,
  auth: Auth,
): Promise<ApiKeySchema[]> {
  auth.assertAccess(collectionName, undefined, "read");
  const cursor = await dbc(auth.kind)
    .find()
    .sort({ [orderBy]: order })
    .skip(offset)
    .limit(limit);
  const documents = await cursor.toArray();
  try {
    return documents.map((document) => ZApiKeySchema.parse(document));
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

// Update an API key. Only the description and scopes can be updated.
// Returns true if the key was updated, false if the key does not exist.
// Accepts a partial update, in which case only the fields that are present
// are updated.
export async function updateApiKey(
  id: string,
  params: AuthContextInfoUpdate,
  auth: Auth,
): Promise<boolean> {
  auth.assertAccess(collectionName, id, "update");
  try {
    const result = await dbc(auth.kind).findOneAndUpdate(
      { _id: id },
      { $set: params },
      { returnDocument: "after" },
    );
    return (!!result.value);
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

// Delete an API key. Returns true if the key was deleted, false if the key
// does not exist.
export async function deleteApiKey(
  id: string,
  auth: Auth,
): Promise<boolean> {
  auth.assertAccess(collectionName, id, "delete");
  const result = await dbc(auth.kind).deleteOne({ _id: id });
  return result.deletedCount === 1;
}
