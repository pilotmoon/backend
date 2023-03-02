import { z } from "zod";

// all the possible collection scopes
export const allCollectionScopes = [
  "health:read",
  "apiKeys:create",
  "apiKeys:read",
  "apiKeys:update",
  "apiKeys:delete",
  "registries:create",
  "registries:read",
  "registries:update",
  "registries:delete",
  "licenseKeys:create",
  "licenseKeys:read",
  "licenseKeys:update",
  "licenseKeys:delete",
];

export const actions = ["create", "read", "update", "delete"] as const;

// scope type
export const Scopes = z.array(z.string());
export type Scopes = Array<string>;
