import { deterministic, randomKey } from "../identifiers";
import { z } from "zod";
import { getDb } from "../database";
import { Binary } from "mongodb";
import { ApiError, handleControllerError } from "../errors";
import { Context, Next } from "koa";
import { log } from "../logger";
import { KeyKind, keyKinds, keyRegex } from "../identifiers";
import { hashPassword, verifyPassword } from "../scrypt";
import TTLCache = require("@isaacs/ttlcache");
import { createHash } from "node:crypto";
import { TestKey, testKeys } from "../../test/api/setup";
import { PaginateState } from "../paginate";
import { allScopes, Scope, Scopes } from "../scopes";

/*** Schemas ***/

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

/*** Scope Assessment ****/

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

/*** Database ***/

// helper function to get the database collection for a given key kind
function dbc(kind: KeyKind) {
  return getDb(kind).collection<ApiKeySchema>("apiKeys");
}

// helper to make a dummy context for inserting a new key
function specialContext(kind: KeyKind): AuthContext {
  return { kind: kind, scopes: ["apiKeys:create"], description: "" };
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
        SettableAuthContext.parse(keyDef),
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
    ApiKeySchema.parse(document);
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
    return ApiKeySchema.parse(document);
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
  return documents.map((document) => ApiKeySchema.parse(document));
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

/*** Middleware ***/

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
  let document = await dbc(kind).findOne({ _id: id });
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
const minute = 1000 * 60;
const ttl = minute * 10;
const revalidateTime = minute * 5;
const authCache = new TTLCache<string, AuthContext>({ max: 100_000, ttl });

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
  } else {
    // revalidate in background if sufficiently old
    const ttlRemaining = authCache.getRemainingTTL(keyParts.cacheKey);
    if (ttlRemaining < ttl - revalidateTime) {
      log("Revalidating API key in background");
      validateSecretKey(keyParts)
        .then((authContext) => {
          authCache.set(keyParts.cacheKey, authContext);
        })
        .catch((err) => {
          log("Error revalidating API key: " + err.message);
          authCache.delete(keyParts.cacheKey);
        });
    }
  }

  log("New auth cache size: " + authCache.size);
  ctx.state.auth = authContext;
  ctx.state.apiKeyId = keyParts.id;
  await next();
}
