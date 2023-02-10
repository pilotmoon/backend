import { randomString } from "@pilotmoon/chewit";
import { z } from "zod";
import { getDb } from "./database";

const apiKeysCollectionName = "apikeys";

const allScopes = [
  "apikeys:create",
  "apikeys:read",
] as const;

// schema for API keys
export const ApiKeyParams = z.object({
  scopes: z.array(z.enum(allScopes)),
  kind: z.enum(["test", "live"]),
  metadata: z.record(z.string().min(1), z.any()).optional(),
});
type ApiKeyParams = z.infer<typeof ApiKeyParams>;
const ApiKeySchema = ApiKeyParams.extend({
  _id: z.string(),
  secret_key: z.string(),
  created: z.date(),
});
type ApiKeySchema = z.infer<typeof ApiKeySchema>;

// called at startup to set the collection index
export async function init() {
  console.log(`init ${apiKeysCollectionName} collection`);
  const result = await getDb()
    .collection(apiKeysCollectionName)
    .createIndex({ secret_key: 1 }, { unique: true });
  console.log("createIndex", result);
}

// create a new API key
export async function createApiKey(
  params: ApiKeyParams,
): Promise<ApiKeySchema> {
  const document = {
    _id: `ak_${randomString()}`,
    secret_key: `key_${params.kind}_${randomString()}`,
    created: new Date(),
    ...params,
  };
  const collection = getDb().collection<ApiKeySchema>(apiKeysCollectionName);
  collection.createIndex({ secret_key: 1 }, { unique: true });
  const result = await collection.insertOne(document);
  console.log(`Inserted API key with _id: ${result.insertedId}`);
  return document;
}
