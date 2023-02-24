import { z } from "zod";

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