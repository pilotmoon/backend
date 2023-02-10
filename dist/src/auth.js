"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiKey = exports.dbInit = exports.ApiKeyParams = void 0;
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
  secret_key: zod_1.z.string(),
  created: zod_1.z.date(),
});
// called at startup to set the collection index
async function dbInit() {
  const result = await (0, database_1.getDb)()
    .collection(apiKeysCollectionName)
    .createIndex({ secret_key: 1 }, { unique: true });
  console.log("dbinit", result);
}
exports.dbInit = dbInit;
// create a new API key
async function createApiKey(params) {
  const document = {
    _id: `ak_${(0, chewit_1.randomString)()}`,
    secret_key: `key_${params.kind}_${(0, chewit_1.randomString)()}`,
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
