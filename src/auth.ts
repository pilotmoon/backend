import { randomString } from "@pilotmoon/chewit";
import { z } from "zod";
import { getDb } from "./database";
import { ApiError } from "./errors";
import { Context, Next } from "koa";

const apiKeysCollectionName = "api_keys";
function getCollection(kind: "test" | "live") {
  const db = getDb(kind);
  return db.collection<ApiKeySchema>(apiKeysCollectionName);
}

const allScopes = [
  "healthcheck:read",
  "api_keys:create",
  "api_keys:read",
  "api_keys:update",
  "api_keys:delete",
] as const;
type Scope = typeof allScopes[number];

// schema for API keys
export const SettableAuthContext = z.object({
  scopes: z.array(z.enum(allScopes)),
  description: z.string().optional(),
});
type SettableAuthContext = z.infer<typeof SettableAuthContext>;
export const PartialAuthContext = SettableAuthContext.partial();
type PartialAuthContext = z.infer<typeof PartialAuthContext>;
export const AuthContext = SettableAuthContext.extend({
  kind: z.enum(["test", "live"]),
});
type AuthContext = z.infer<typeof AuthContext>;
const ApiKeySchema = AuthContext.extend({
  _id: z.string(),
  object: z.literal("api_key"),
  key: z.string(),
});
type ApiKeySchema = z.infer<typeof ApiKeySchema>;

// called at startup to set the collection index
export async function init() {
  console.log(`init ${apiKeysCollectionName} collection`);
  // set for both test and live database
  for (const kind of ["test", "live"] as const) {
    const db = getDb(kind);
    const collection = db.collection(apiKeysCollectionName);
    const result = await collection.createIndex({ key: 1 }, { unique: true });
    console.log("createIndex", db.databaseName, apiKeysCollectionName, result);

    // count documents in collection
    const count = await collection.countDocuments();
    if (count == 0) {
      console.log("No API keys found, creating bootstrap key", kind.blue);
      // create an api key to bootstrap the system
      const authContext = {
        kind,
        scopes: allScopes as any,
        metadata: { description: "bootstrap key" },
      };
      await createApiKey(authContext, authContext);
    }
  }
}

// function for verifying whether the auth context has a given scope
export async function verifyScope(
  scope: Scope,
  authContext: AuthContext,
): Promise<void> {
  if (!authContext.scopes.includes(scope)) {
    throw new ApiError(403, "Missing required scope: " + scope);
  }
}

// create a new API key. returns the new key
export async function createApiKey(
  params: SettableAuthContext,
  authContext: AuthContext,
): Promise<ApiKeySchema> {
  await verifyScope("api_keys:create", authContext);
  const document = {
    _id: `ak_${randomString()}`,
    object: "api_key" as const,
    created: new Date(),
    key: `key_${authContext.kind}_${randomString()}`,
    kind: authContext.kind,
    ...params,
  };
  const result = await getCollection(authContext.kind).insertOne(document);
  console.log(`Inserted API key with _id: ${result.insertedId}`);
  return document;
}

// return an API key by its ID. returns null if the key does not exist
export async function readApiKey(
  id: string,
  authContext: AuthContext,
): Promise<ApiKeySchema | null> {
  await verifyScope("api_keys:read", authContext);
  return await getCollection(authContext.kind).findOne({ _id: id });
}

// update updatable fields of an API key and return the updated document
// returns null if the key does not exist
export async function updateApiKey(
  id: string,
  params: PartialAuthContext,
  authContext: AuthContext,
): Promise<ApiKeySchema | null> {
  await verifyScope("api_keys:update", authContext);
  const result = await getCollection(authContext.kind).findOneAndUpdate({
    _id: id,
  }, {
    $set: params,
    $currentDate: {
      modified: true,
    },
  }, {
    returnDocument: "after",
  });
  return result.value;
}

// delete an API key by its ID. returns true if the key was deleted
export async function deleteApiKey(
  id: string,
  authContext: AuthContext,
): Promise<boolean> {
  await verifyScope("api_keys:delete", authContext);
  const result = await getCollection(authContext.kind).deleteOne({ _id: id });
  return result.deletedCount === 1;
}

// auth middleware, allow Bearer token or x-api-key header
export async function authMiddleware(ctx: Context, next: Next) {
  const authorizationHeader = ctx.request.headers["authorization"];
  const apiKeyHeader = ctx.request.headers["x-api-key"];
  let key = "";
  if (typeof authorizationHeader === "string") {
    const bearerPrefix = "Bearer ";
    if (authorizationHeader.startsWith(bearerPrefix)) {
      key = authorizationHeader.substring(bearerPrefix.length);
    } else {
      throw new ApiError(401, "Authorization header must start with Bearer");
    }
  } else if (typeof apiKeyHeader === "string" && apiKeyHeader.length > 0) {
    key = apiKeyHeader;
  } else {
    throw new ApiError(401, "API key is required");
  }

  // regex match the kind part of the key
  const match = key.match(/^key_(test|live)_/);
  if (!match) {
    throw new ApiError(401, "Invalid API key prefix");
  }
  const kind = match[1] as "test" | "live";
  console.log("API key kind:", kind.blue);

  // now we have key, look it up in the database
  const collection = getDb(kind).collection<ApiKeySchema>(
    apiKeysCollectionName,
  );
  const document = await collection.findOne({ key: key });
  if (!document) {
    throw new ApiError(401, "Unknown API key");
  }
  console.log("Api key ID:", document._id.blue);
  ctx.state.apiKeyId = document._id;

  // validate and store the document as the auth context
  try {
    const authContext = AuthContext.parse(document);
    console.log("Auth context:", JSON.stringify(authContext).blue);
    ctx.state.auth = authContext;
  } catch (err) {
    console.error("Error parsing auth context", err);
    throw new ApiError(500, "Error parsing auth context");
  }

  await next();
}
