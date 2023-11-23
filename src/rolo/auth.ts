import { z } from "zod";
import { ApiError } from "../common/errors.js";
import { log } from "../common/log.js";
import { collectionNames } from "./identifiers.js";

// Auth "kinds" refer to the test and live variations of the api keys.
// all operations initiated by the api key happen against the corresponding
// database, and the api key is only valid for that database.
export const authKinds = ["test", "live"] as const;
export type AuthKind = typeof authKinds[number];

// schema for the part of the auth context that can be set by the client
export const ZSettableAuthContext = z.object({
  scopes: z.array(z.string()),
  expires: z.date().optional(),
});
type SettableAuthContext = z.infer<typeof ZSettableAuthContext>;

// Schema for the pertinent auth info of a key, including the key kind (test or live)
// which is derived from the auth context used to create the key.
// It is not possible to create a test key with a live auth context,
// or vice versa.
export const ZAuthInfo = ZSettableAuthContext.extend({
  kind: z.enum(authKinds),
});
type AuthInfo = z.infer<typeof ZAuthInfo>;

// auth class extends AuthContext by adding functions to validate access
export class Auth implements AuthInfo {
  scopes: string[];
  kind: AuthKind;
  expires?: Date;

  constructor(public readonly authContext: AuthInfo) {
    this.scopes = authContext.scopes;
    this.kind = authContext.kind;
    this.expires = authContext.expires;
    this.assertValid();
  }

  assertValid() {
    if (!authKinds.includes(this.kind)) {
      throw new ApiError(500, "Invalid key kind");
    }
    if (this.expires && this.expires < new Date()) {
      throw new ApiError(401, "Expired token or key");
    }
    if (!this.scopes.length) {
      throw new ApiError(403, "No scope");
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
      "*",
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
