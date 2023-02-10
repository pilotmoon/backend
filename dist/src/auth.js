"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiKeyById =
  exports.getApiKeyBySecretKey =
  exports.createApiKey =
  exports.init =
  exports.ApiKeyParams =
    void 0;
const chewit_1 = require("@pilotmoon/chewit");
const zod_1 = require("zod");
const database_1 = require("./database");
const apiKeysCollectionName = "apikeys";
const allScopes = [
  "apikeys:create",
  "apikeys:read",
];
// schema for API keys
exports.ApiKeyParams = zod_1.z.object({
  scopes: zod_1.z.array(zod_1.z.enum(allScopes)),
  kind: zod_1.z.enum(["test", "live"]),
  metadata: zod_1.z.record(zod_1.z.string().min(1), zod_1.z.any()).optional(),
});
const ApiKeySchema = exports.ApiKeyParams.extend({
  _id: zod_1.z.string(),
  object: zod_1.z.literal("apikey"),
  key: zod_1.z.string(),
  created: zod_1.z.date(),
});
// called at startup to set the collection index
async function init() {
  console.log(`init ${apiKeysCollectionName} collection`);
  const result = await (0, database_1.getDb)()
    .collection(apiKeysCollectionName)
    .createIndex({ secret_key: 1 }, { unique: true });
  console.log("createIndex", result);
}
exports.init = init;
// create a new API key
async function createApiKey(params) {
  const document = {
    _id: `ak_${(0, chewit_1.randomString)()}`,
    object: "apikey",
    key: `key_${params.kind}_${(0, chewit_1.randomString)()}`,
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
// get an API key by secret key
async function getApiKeyBySecretKey(secretKey) {
  const collection = (0, database_1.getDb)().collection(apiKeysCollectionName);
  const result = await collection.findOne({ secret_key: secretKey });
  return result;
}
exports.getApiKeyBySecretKey = getApiKeyBySecretKey;
// get an API key by id
async function getApiKeyById(id) {
  const collection = (0, database_1.getDb)().collection(apiKeysCollectionName);
  const result = await collection.findOne({ _id: id });
  return result;
}
exports.getApiKeyById = getApiKeyById;
