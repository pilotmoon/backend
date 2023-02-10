"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiKey = exports.ApiKeyParams = void 0;
const chewit_1 = require("@pilotmoon/chewit");
const zod_1 = require("zod");
const database_1 = require("./database");
const apiKeysCollectionName = "apikeys";
exports.ApiKeyParams = zod_1.z.object({
  scopes: zod_1.z.array(zod_1.z.string()),
  kind: zod_1.z.enum(["test", "live"]),
  description: zod_1.z.string().optional(),
  entity: zod_1.z.string().optional(),
});
const ApiKeySchema = exports.ApiKeyParams.extend({
  _id: zod_1.z.string(),
  secret_key: zod_1.z.string(),
  created: zod_1.z.date(),
});
async function createApiKey(params) {
  const { id, secret_key } = generateKeys(params.kind);
  const document = {
    _id: id,
    secret_key,
    created: new Date(),
    ...params,
  };
  const collection = (0, database_1.getDb)().collection(apiKeysCollectionName);
  collection.createIndex({ secret_key: 1 }, { unique: true });
  const result = await collection.insertOne(document);
  console.log(`Inserted API key with _id: ${result.insertedId}`);
  return document;
}
exports.createApiKey = createApiKey;
function generateKeys(kind) {
  const clear = (0, chewit_1.randomString)({ length: 7 });
  const id = `ak_${(0, chewit_1.randomString)({ length: 24 })}`;
  const secret_key = `key_${kind}_${
    (0, chewit_1.randomString)({ length: 24 })
  }`;
  return { id, secret_key };
}
