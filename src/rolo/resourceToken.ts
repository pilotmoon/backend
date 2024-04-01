import TTLCache from "@isaacs/ttlcache";
import { generateEncryptedToken } from "./token.js";
import { AuthKind } from "./auth";
import { minutes } from "../common/timeIntervals";

const cachedTokens = new TTLCache({
  max: 1000,
  ttl: minutes(60),
});

export function generateResourceToken(
  collection: string,
  id: string,
  kind: AuthKind,
): string {
  // generate a URL to read the resource, with an access token
  // that doesn't expire. token is cached so that the same token is returned
  // on subsequent requests. this is mainly to help testing.
  const cached = cachedTokens.get(id);
  if (typeof cached === "string") return cached;

  const resource = `${collection}/${id}`;
  const result = generateEncryptedToken({
    keyKind: kind,
    scopes: [`${resource}:read`],
    expires: undefined,
    resource: resource,
  });
  cachedTokens.set(id, result);
  return result;
}
