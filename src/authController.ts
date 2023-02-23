import { deterministic, randomKey } from "./identifiers";
import { z } from "zod";
import { getDb } from "./database";
import { Binary } from "mongodb";
import { ApiError } from "./errors";
import { Context, Next } from "koa";
import { log, loge } from "./logger";
import { KeyKind, keyKinds, keyRegex } from "./identifiers";
import { hashPassword, verifyPassword } from "./scrypt";
import TTLCache = require("@isaacs/ttlcache");
import { createHash } from "node:crypto";
import { TestKey, testKeys } from "../test/api/setup";

const apiKeysCollectionName = "apiKeys";
function getCollection(kind: KeyKind) {
  const db = getDb(kind);
  return db.collection<ApiKeySchema>(apiKeysCollectionName);
}

// all the possible scopes
const constScopes = [
  "health:read",
  "apiKeys:create",
  "apiKeys:read",
  "apiKeys:update",
  "apiKeys:delete",
  "products:create",
  "products:read",
  "products:update",
  "products:delete",
] as const;

// scope type
export const Scopes = z.array(z.enum(constScopes));
export type Scopes = z.infer<typeof Scopes>;
export type Scope = Scopes[number];
export const allScopes: Scopes = constScopes as any;

// schema for API keys
export const SettableAuthContext = z.object({
  scopes: Scopes,
  description: z.string(),
});
type SettableAuthContext = z.infer<typeof SettableAuthContext>;
export const PartialAuthContext = SettableAuthContext.partial();
type PartialAuthContext = z.infer<typeof PartialAuthContext>;
export const AuthContext = SettableAuthContext.extend({
  kind: z.enum(keyKinds),
});
export type AuthContext = z.infer<typeof AuthContext>;
const ApiKeySchema = AuthContext.extend({
  _id: z.string(),
  object: z.literal("apiKey"),
  key: z.string().optional(),
  hashedKey: z.custom<Binary>((v) => v instanceof Binary),
  created: z.date(),
});
export type ApiKeySchema = z.infer<typeof ApiKeySchema>;

// called at startup to prepare the database
export async function init() {
  log(`init ${apiKeysCollectionName} collection`);

  // for both test and live database
  for (const kind of keyKinds) {
    const collection = getCollection(kind);
    collection.createIndex({ created: 1 });

    // if there are no keys, create a bootstrap key
    const count = await collection.countDocuments();
    if (count == 0) {
      log("No API keys found, creating bootstrap key", kind.blue);
      const settableAuthContext = {
        scopes: allScopes,
        description: "bootstrap key (randomly generated)",
      };
      const document = await createApiKey(settableAuthContext, {
        kind: kind,
        scopes: ["apiKeys:create"],
        description: "",
      });
      console.log("Bootstrap key:".bgRed, document.key);
    }
  }

  // create deterministic test keys
  console.log("Creating fixed test keys");
  await deterministic(async () => {
    for (
      const [name, keyDef] of Object.entries<TestKey>(testKeys)
    ) {
      if (keyDef.scopes === "#all#") {
        keyDef.scopes = allScopes as any;
      }
      keyDef.description = `[${name}] ` + keyDef.description;
      const authContext = SettableAuthContext.parse(keyDef);
      await createApiKey(authContext, {
        kind: "test",
        scopes: ["apiKeys:create"],
        description: "",
      }, { replace: true });
    }
  });
}

// functions for verifying whether the auth context has a given scope
export function assertScope(
  scope: Scope,
  authContext: AuthContext,
) {
  if (!hasScope(scope, authContext)) {
    throw new ApiError(403, "Missing required scope: " + scope);
  }
}
export function hasScope(
  scope: Scope,
  authContext: AuthContext,
) {
  return authContext.scopes.includes(scope);
}

// create a new API key. returns the new key
export async function createApiKey(
  params: SettableAuthContext,
  authContext: AuthContext,
  { replace = false }: { replace?: boolean } = {},
): Promise<ApiKeySchema> {
  assertScope("apiKeys:create", authContext);
  const { id, key } = randomKey(authContext.kind, "ak");
  const document = {
    _id: id,
    object: "apiKey" as const,
    hashedKey: new Binary(await hashPassword(key)),
    kind: authContext.kind,
    created: new Date(),
    ...params,
  };
  if (replace) {
    await getCollection(authContext.kind).deleteOne({ _id: document._id });
  }

  const result = await getCollection(authContext.kind).insertOne(
    ApiKeySchema.parse(document),
  );
  log(`Inserted API key with _id: ${result.insertedId}`);
  return { ...document, key }; // return the key in cleartext since it's a new key
}

// return an API key by its ID. returns null if the key does not exist
export async function readApiKey(
  id: string,
  authContext: AuthContext,
): Promise<ApiKeySchema | null> {
  assertScope("apiKeys:read", authContext);
  const document = await getCollection(authContext.kind).findOne({ _id: id });
  return document === null ? null : ApiKeySchema.parse(document);
}

// update updatable fields of an API key and return the updated document
// returns false if the key does not exist, returns null if the key exists
// but the user does not have permission to read it, otherwise returns the
// updated document
export async function updateApiKey(
  id: string,
  params: PartialAuthContext,
  authContext: AuthContext,
): Promise<ApiKeySchema | null | false> {
  assertScope("apiKeys:update", authContext);
  const result = await getCollection(authContext.kind).findOneAndUpdate({
    _id: id,
  }, {
    $set: params,
  }, {
    returnDocument: "after",
  });
  const document = result.value;
  if (typeof document === "object" && document !== null) {
    if (hasScope("apiKeys:read", authContext)) {
      log("Returning updated API key record");
      return ApiKeySchema.parse(document);
    } else {
      log("No read scope, so not returning record");
      return null;
    }
  } else {
    log("API key record not found");
    return false;
  }
}

// delete an API key by its ID. returns true if the key was deleted
export async function deleteApiKey(
  id: string,
  authContext: AuthContext,
): Promise<boolean> {
  assertScope("apiKeys:delete", authContext);
  const result = await getCollection(authContext.kind).deleteOne({ _id: id });
  return result.deletedCount === 1;
}

/*** middleware ***/

interface SecretKeyParts {
  key: string;
  kind: KeyKind;
  id: string;
  cacheKey: string;
}

function parseSecretKey(key: string): SecretKeyParts {
  // example key format
  // key_test_1J2k3L4m5N6o7P8q9R0s1T2u3V4w5X6y7Z8ty37q
  const match = key.match(keyRegex);
  if (!match) {
    throw new ApiError(401, "Invalid API key (bad format)");
  }
  const kind = match[1] as KeyKind;
  const id = "ak_" + match[2];

  // generate sha256 hashed version of the key so we can store it
  // in the cache without exposing the secret key to the cache.
  // include the unique keyId in the cache key so that there is no
  // chance of a collision between different keys.
  const hash = createHash("sha256");
  hash.update(key);
  const cacheKey = id + ":" + hash.digest("hex");

  return { key, kind, id, cacheKey };
}

// fetch the key record from the database and verify the secret key
// note: this function usually takes ~100ms to run so should be cached
async function validateSecretKey({ key, kind, id }: SecretKeyParts) {
  let document = await getCollection(kind).findOne({ _id: id });
  if (!document) {
    throw new ApiError(401, "Invalid API key (bad id)");
  }

  // parse the document to catch any schema errors
  document = ApiKeySchema.parse(document);

  // verify the key
  const valid = await verifyPassword(
    Buffer.from(document.hashedKey.buffer),
    key,
  );
  if (!valid) {
    throw new ApiError(401, "Invalid API key (bad secret)");
  }

  // parsing again returns a more specific type
  return AuthContext.parse(document);
}

// auth cache
const authCache = new TTLCache<string, AuthContext>({
  max: 100000,
  ttl: 1000 * 60 * 60, // 1 hour
});

// auth middleware, allow Bearer token or x-api-key header
export async function authMiddleware(ctx: Context, next: Next) {
  const bearerPrefix = "Bearer ";
  const authorization = ctx.request.headers["authorization"];
  let key = "";
  if (typeof authorization === "string") {
    if (authorization.startsWith(bearerPrefix)) {
      key = authorization.substring(bearerPrefix.length);
    } else {
      throw new ApiError(401, "Bearer token is required");
    }
  } else {
    throw new ApiError(401, "API key is required");
  }

  // check the cache
  const keyParts = parseSecretKey(key);
  let authContext = authCache.get(keyParts.cacheKey);

  // if not in the cache, perform full validation
  if (!authContext) {
    authContext = await validateSecretKey(keyParts);
    authCache.set(keyParts.cacheKey, authContext);
  }

  log("New auth cache size: " + authCache.size);
  ctx.state.auth = authContext;
  ctx.state.apiKeyId = keyParts.id;
  await next();
}
