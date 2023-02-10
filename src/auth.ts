import { randomString } from "@pilotmoon/chewit";
import { z } from "zod";
import { getDb } from "./database";

const apiKeysCollectionName = "api_keys";

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
  object: z.literal("api_key"),
  key: z.string(),
  created: z.date(),
});
type ApiKeySchema = z.infer<typeof ApiKeySchema>;

// called at startup to set the collection index
export async function init() {
  console.log(`init ${apiKeysCollectionName} collection`);
  const result = await getDb()
    .collection(apiKeysCollectionName)
    .createIndex({ key: 1 }, { unique: true });
  console.log("createIndex", result);
}

// create a new API key
export async function createApiKey(
  params: ApiKeyParams,
): Promise<ApiKeySchema> {
  const document = {
    _id: `ak_${randomString()}`,
    object: "api_key" as const,
    created: new Date(),
    key: `key_${params.kind}_${randomString()}`,
    ...params,
  };
  const collection = getDb().collection<ApiKeySchema>(apiKeysCollectionName);
  const result = await collection.insertOne(document);
  console.log(`Inserted API key with _id: ${result.insertedId}`);
  return document;
}

// get an API key by secret key
export async function getApiKeyBySecretKey(
  secretKey: string,
): Promise<ApiKeySchema | null> {
  const collection = getDb().collection<ApiKeySchema>(apiKeysCollectionName);
  const result = await collection.findOne({ secret_key: secretKey });
  return result;
}

// get an API key by id
export async function getApiKeyById(
  id: string,
): Promise<ApiKeySchema | null> {
  const collection = getDb().collection<ApiKeySchema>(apiKeysCollectionName);
  const result = await collection.findOne({ _id: id });
  return result;
}
