import { randomString } from "@pilotmoon/chewit";
import { z } from "zod";
import { getDb } from "./database";
import { ApiError } from "./errors";
import { Context, Next } from "koa";

const apiKeysCollectionName = "api_keys";

const allScopes = [
  "api_keys:create",
  "api_keys:read",
] as const;
type Scope = typeof allScopes[number];

// schema for API keys
export const AuthContext = z.object({
  scopes: z.array(z.enum(allScopes)),
  kind: z.enum(["test", "live"]),
  metadata: z.record(z.string().min(1), z.any()).optional(),
});
type AuthContext = z.infer<typeof AuthContext>;
const ApiKeySchema = AuthContext.extend({
  _id: z.string(),
  object: z.literal("api_key"),
  key: z.string(),
  created: z.date(),
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

// create a new API key
export async function createApiKey(
  params: AuthContext,
  authContext: AuthContext,
): Promise<ApiKeySchema> {
  await verifyScope("api_keys:create", authContext);
  if (params.kind !== authContext.kind) {
    throw new ApiError(403, "Cannot create API key for different database");
  }
  const document = {
    _id: `ak_${randomString()}`,
    object: "api_key" as const,
    created: new Date(),
    key: `key_${params.kind}_${randomString()}`,
    ...params,
  };
  const collection = getDb(authContext.kind).collection<ApiKeySchema>(
    apiKeysCollectionName,
  );
  const result = await collection.insertOne(document);
  console.log(`Inserted API key with _id: ${result.insertedId}`);
  return document;
}

// get an API key by id
export async function lookupById(
  id: string,
  authContext: AuthContext,
): Promise<ApiKeySchema | null> {
  await verifyScope("api_keys:read", authContext);
  const collection = getDb(authContext.kind).collection<ApiKeySchema>(
    apiKeysCollectionName,
  );
  const result = await collection.findOne({ _id: id });
  return result;
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
