import { ApiError } from "../errors";
import { Context, Next } from "koa";
import { log } from "../logger";
import { KeyKind, secretKeyRegex } from "../identifiers";
import { verifyPassword } from "../scrypt";

import {
  Auth,
  readApiKey,
  specialContext,
  ZAuthContext,
} from "../controllers/authController";
import TTLCache = require("@isaacs/ttlcache");
import { sha256Hex } from "../sha256";
import { decipherToken } from "../token";

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
  const match = key.match(secretKeyRegex);
  if (!match) {
    throw new ApiError(401, "Invalid API key (bad format)");
  }
  const kind = match[1] as KeyKind;
  const id = "ak_" + match[2];

  // generate sha256 hashed version of the key so we can store it
  // in the cache without exposing the secret key to the cache.
  // include the unique keyId as a prefix so that there is no
  // chance of a collision between different keys.
  const cacheKey = id + ":" + sha256Hex(key);

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
const authCache = new TTLCache<string, Auth>({ max: 100000, ttl });

// authorization middleware.
// this middleware checks the authorization header or token.
// token is expected to be in the query string with the name "token".
// if the header or token is valid, the auth object is added to the
// context and the request is passed on to the next middleware.
// if the header or token is invalid, an error is thrown.
// if both a header and token are present, the header takes precedence
// and the token is ignored.
export async function authorize(ctx: Context, next: Next) {
  // get the authorization header and token
  const authorization = ctx.request.headers["authorization"];
  const token = ctx.request.query.token;

  if (typeof authorization === "string") {
    // get the actual key
    const bearerPrefix = "Bearer ";
    const prefix = authorization.substring(0, bearerPrefix.length);
    const key = authorization.substring(bearerPrefix.length);
    if (prefix !== bearerPrefix || !key) {
      throw new ApiError(401, "Bearer token is required");
    }
    await authorizeKey(key, ctx);
  } else if (typeof token === "string") {
    // decipher the token
    try {
      // extract resource from the first two path segments.
      const resource = ctx.path
        .split("/")
        .slice(1, 3)
        .join("/");
      log("Resource: " + resource);

      const { keyKind: kind, secretKey, scopes } = decipherToken(
        token,
        resource,
      );
      if (secretKey) {
        await authorizeKey(secretKey, ctx);
      } else if (scopes) {
        log("Token scopes: " + scopes.join(", "));
        ctx.state.auth = new Auth({
          kind,
          scopes,
          description: "Token",
        });
      } else {
        throw new ApiError(401, "Invalid token (no key or scopes)");
      }
    } catch (err) {
      throw new ApiError(401, "Invalid token");
    }
  } else {
    throw new ApiError(401, "API key or access token is required");
  }
  // TODO: add support for expiring tokens

  await next();
}

async function authorizeKey(key: string, ctx: Context) {
  // check the cache
  const keyParts = parseSecretKey(key);
  let auth = authCache.get(keyParts.cacheKey);

  // if not in the cache, perform full validation
  if (!auth) {
    auth = new Auth(await validateSecretKey(keyParts));
    authCache.set(keyParts.cacheKey, auth);
  } else {
    // revalidate in background if sufficiently old
    const ttlRemaining = authCache.getRemainingTTL(keyParts.cacheKey);
    if (ttlRemaining < ttl - revalidateTime) {
      log("Revalidating API key in background");
      validateSecretKey(keyParts)
        .then((authContext) => {
          authCache.set(keyParts.cacheKey, new Auth(authContext));
        })
        .catch((err) => {
          log("Error revalidating API key: " + err.message);
          authCache.delete(keyParts.cacheKey);
        });
    }
  }

  log("New auth cache size: " + authCache.size);
  ctx.state.auth = auth;
  ctx.state.apiKeyId = keyParts.id;
  log("Key ID: " + keyParts.id);
}
