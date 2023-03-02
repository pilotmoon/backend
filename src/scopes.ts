import { z } from "zod";

// all the possible collection scopes
export const allCollectionScopes = [
  "health:read",
  "apiKeys:create",
  "apiKeys:read",
  "apiKeys:list",
  "apiKeys:update",
  "apiKeys:delete",
  "registries:create",
  "registries:read",
  "registries:list",
  "registries:update",
  "registries:delete",
  "licenseKeys:create",
  "licenseKeys:read",
  "licenseKeys:list",
  "licenseKeys:update",
  "licenseKeys:delete",
];

export const actions = ["create", "read", "list", "update", "delete"] as const;

// scope type
export const Scopes = z.array(z.string());
export type Scopes = Array<string>;
