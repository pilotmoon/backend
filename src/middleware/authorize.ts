import { ApiError } from "../errors";
import { Context, Next } from "koa";
import { log } from "../logger";
import { KeyKind, keyRegex } from "../identifiers";
import { verifyPassword } from "../scrypt";
import { createHash } from "node:crypto";
import {
  AuthContext,
  readApiKey,
  specialContext,
  ZAuthContext,
} from "../controllers/authController";
import TTLCache = require("@isaacs/ttlcache");

// container for a deconstructed secret key
interface SecretKeyParts {
  key: string;
  kind: KeyKind;
  id: string;
  cacheKey: string;
}

// parse the secret key and generate a cache key
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
  // include the unique keyId as a prefix so that there is no
  // chance of a collision between different keys.
  const hash = createHash("sha256");
  hash.update(key);
  const cacheKey = id + ":" + hash.digest("hex");

  return { key, kind, id, cacheKey };
}

// fetch the key record from the database and verify the secret key
// note: this function usually takes ~100ms to run so should be cached
// if called frequently.
async function validateSecretKey({ key, kind, id }: SecretKeyParts) {
  const document = await readApiKey(id, specialContext(kind));
  if (!document) {
    throw new ApiError(401, "Invalid API key (not found)");
  }

  // verify the key against the hashed version
  const hash = Buffer.from(document.hashedKey.buffer);
  if (!await verifyPassword(hash, key)) {
    throw new ApiError(401, "Invalid API key (bad secret)");
  }

  // parsing again returns a more specific type
  return ZAuthContext.parse(document);
}

// auth cache
const minute = 1000 * 60;
const ttl = minute * 10;
const revalidateTime = minute * 5;
const authCache = new TTLCache<string, AuthContext>({ max: 100000, ttl });

// authorization middleware
export async function authorize(ctx: Context, next: Next) {
  // get the authorization header
  const authorization = ctx.request.headers["authorization"];
  if (typeof authorization !== "string") {
    throw new ApiError(401, "Authorization header is required");
  }

  // get the actual key
  const bearerPrefix = "Bearer ";
  const prefix = authorization.substring(0, bearerPrefix.length);
  const key = authorization.substring(bearerPrefix.length);
  if (prefix !== bearerPrefix || !key) {
    throw new ApiError(401, "Bearer token is required");
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
