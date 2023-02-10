import { randomString } from "@pilotmoon/chewit";
import { z } from "zod";
import { getDb } from "./database";
import { ApiError } from "./errors";
import { Context, Next } from "koa";

const apiKeysCollectionName = "api_keys";

const allScopes = [
  "apikeys:create",
  "apikeys:read",
] as const;

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
  key: z.string().optional(),
  created: z.date(),
});
type ApiKeySchema = z.infer<typeof ApiKeySchema>;

// called at startup to set the collection index
export async function init() {
  console.log(`init ${apiKeysCollectionName} collection`);
  // set for both test and live database
  for (const kind of ["test", "live"] as const) {
    const db = getDb(kind);
    const result = await db
      .collection(apiKeysCollectionName)
      .createIndex({ key: 1 }, { unique: true });
    console.log("createIndex", db.databaseName, apiKeysCollectionName, result);
  }
}

// create a new API key
export async function createApiKey(
  params: AuthContext,
  authContext: AuthContext,
): Promise<ApiKeySchema> {
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
  const collection = getDb(authContext.kind).collection<ApiKeySchema>(
    apiKeysCollectionName,
  );
  const result = await collection.findOne({ _id: id });
  if (result) delete result.key; // don't return the secret key itself
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
  let keyKind = match[1] as "test" | "live";
  console.log("API key kind:", keyKind.blue);

  // now we have key, look it up in the database
  const collection = getDb(keyKind).collection<ApiKeySchema>(
    apiKeysCollectionName,
  );
  const document = await collection.findOne({ key: key });
  if (!document) {
    throw new ApiError(401, "Unknown API key");
  }

  // store the info for the rest of the app to access
  const authContext = AuthContext.parse(document);
  console.log("Auth context:", JSON.stringify(authContext).blue);

  ctx.state.auth = authContext;
  await next();
}
