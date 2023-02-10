import { randomString } from "@pilotmoon/chewit";
import { z } from "zod";
import { cleanDocument, getDb } from "./database";

const apiKeysCollectionName = "apikeys";

export const ApiKeyParams = z.object({
  scopes: z.array(z.string()),
  kind: z.enum(["test", "live"]),
  description: z.string().optional(),
  entity: z.string().optional(),
});
type ApiKeyParams = z.infer<typeof ApiKeyParams>;

const ApiKeySchema = ApiKeyParams.extend({
  _id: z.string(),
  secret_key: z.string(),
  created: z.date(),
});
type ApiKeySchema = z.infer<typeof ApiKeySchema>;

export async function createApiKey(
  params: ApiKeyParams,
): Promise<ApiKeySchema> {
  const { id, secret_key } = generateKeys(params.kind);
  const document = {
    _id: id,
    secret_key,
    created: new Date(),
    ...params,
  };
  const collection = getDb().collection<ApiKeySchema>(apiKeysCollectionName);
  collection.createIndex({ secret_key: 1 }, { unique: true });
  const result = await collection.insertOne(document);
  console.log(`Inserted API key with _id: ${result.insertedId}`);
  return document;
}

function generateKeys(kind: "test" | "live") {
  const clear = randomString({ length: 7 });
  const id = `ak_${randomString({ length: 24 })}`;
  const secret_key = `key_${kind}_${randomString({ length: 24 })}`;
  return { id, secret_key };
}
