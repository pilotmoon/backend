import { deterministic, randomKey } from "../identifiers";
import { z } from "zod";
import { getDb } from "../database";
import { Binary } from "mongodb";
import { ApiError, handleControllerError } from "../errors";
import { log } from "../logger";
import { KeyKind, keyKinds } from "../identifiers";
import { hashPassword } from "../scrypt";
import { TestKey, testKeys } from "../../test/api/setup";
import { PaginateState } from "../middleware/paginate";
import { allScopes, Scope, Scopes } from "../scopes";

/*** Schemas ***/

export const ZSettableAuthContext = z.object({
  scopes: Scopes,
  description: z.string(),
});
type SettableAuthContext = z.infer<typeof ZSettableAuthContext>;
export const ZPartialAuthContext = ZSettableAuthContext.partial();
type PartialAuthContext = z.infer<typeof ZPartialAuthContext>;
export const ZAuthContext = ZSettableAuthContext.extend({
  kind: z.enum(keyKinds),
});
export type AuthContext = z.infer<typeof ZAuthContext>;
export const ZApiKeySchema = ZAuthContext.extend({
  _id: z.string(),
  object: z.literal("apiKey"),
  key: z.string().optional(),
  hashedKey: z.custom<Binary>((v) => v instanceof Binary),
  created: z.date(),
});
export type ApiKeySchema = z.infer<typeof ZApiKeySchema>;

/*** Scope Assessment ****/

export function assertScope(
  scope: Scope,
  authContext: AuthContext,
) {
  if (!authContext.scopes.includes(scope)) {
    throw new ApiError(403, "Missing required scope: " + scope);
  }
}

/*** Database ***/

// helper function to get the database collection for a given key kind
export function dbc(kind: KeyKind) {
  return getDb(kind).collection<ApiKeySchema>("apiKeys");
}

// helper to make a dummy context for inserting and reading keys
export function specialContext(kind: KeyKind): AuthContext {
  return {
    kind: kind,
    scopes: ["apiKeys:create", "apiKeys:read"],
    description: "",
  };
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
        scopes: allScopes,
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
      if (keyDef.scopes === "#all#") keyDef.scopes = allScopes;
      keyDef.description = `[${name}] ` + keyDef.description;
      await createApiKey(
        ZSettableAuthContext.parse(keyDef),
        specialContext("test"),
        { replace: true },
      );
    }
  });
}

/*** C.R.U.D. ***/

export async function createApiKey(
  params: SettableAuthContext,
  auth: AuthContext,
  { replace = false }: { replace?: boolean } = {},
): Promise<ApiKeySchema> {
  assertScope("apiKeys:create", auth);
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

export async function readApiKey(
  id: string,
  auth: AuthContext,
): Promise<ApiKeySchema | null> {
  assertScope("apiKeys:read", auth);
  const document = await dbc(auth.kind).findOne({ _id: id });
  if (!document) return null;
  try {
    return ZApiKeySchema.parse(document);
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

export async function listApiKeys(
  { limit, offset, order, orderBy }: PaginateState,
  auth: AuthContext,
): Promise<ApiKeySchema[]> {
  assertScope("apiKeys:read", auth);
  const cursor = await dbc(auth.kind)
    .find()
    .sort({ [orderBy]: order })
    .skip(offset)
    .limit(limit);
  const documents = await cursor.toArray();
  return documents.map((document) => ZApiKeySchema.parse(document));
}

export async function updateApiKey(
  id: string,
  params: PartialAuthContext,
  auth: AuthContext,
): Promise<boolean> {
  assertScope("apiKeys:update", auth);
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

export async function deleteApiKey(
  id: string,
  auth: AuthContext,
): Promise<boolean> {
  assertScope("apiKeys:delete", auth);
  const result = await dbc(auth.kind).deleteOne({ _id: id });
  return result.deletedCount === 1;
}
