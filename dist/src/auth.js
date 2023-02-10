"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware =
  exports.lookupById =
  exports.lookupByKey =
  exports.createApiKey =
  exports.init =
  exports.ApiKeyParams =
    void 0;
const chewit_1 = require("@pilotmoon/chewit");
const zod_1 = require("zod");
const database_1 = require("./database");
const errors_1 = require("./errors");
const apiKeysCollectionName = "api_keys";
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
  object: zod_1.z.literal("api_key"),
  key: zod_1.z.string().optional(),
  created: zod_1.z.date(),
});
// called at startup to set the collection index
async function init() {
  console.log(`init ${apiKeysCollectionName} collection`);
  const result = await (0, database_1.getDb)()
    .collection(apiKeysCollectionName)
    .createIndex({ key: 1 }, { unique: true });
  console.log("createIndex", result);
}
exports.init = init;
// create a new API key
async function createApiKey(params) {
  const document = {
    _id: `ak_${(0, chewit_1.randomString)()}`,
    object: "api_key",
    created: new Date(),
    key: `key_${params.kind}_${(0, chewit_1.randomString)()}`,
    ...params,
  };
  const collection = (0, database_1.getDb)().collection(apiKeysCollectionName);
  const result = await collection.insertOne(document);
  console.log(`Inserted API key with _id: ${result.insertedId}`);
  return document;
}
exports.createApiKey = createApiKey;
// get an API key by secret key
async function lookupByKey(key) {
  const collection = (0, database_1.getDb)().collection(apiKeysCollectionName);
  const result = await collection.findOne({ key: key });
  return result;
}
exports.lookupByKey = lookupByKey;
// get an API key by id
async function lookupById(id) {
  const collection = (0, database_1.getDb)().collection(apiKeysCollectionName);
  const result = await collection.findOne({ _id: id });
  return result;
}
exports.lookupById = lookupById;
// auth middleware, allow Bearer token or x-api-key header
async function authMiddleware(ctx, next) {
  const authorizationHeader = ctx.request.headers["authorization"];
  const apiKeyHeader = ctx.request.headers["x-api-key"];
  let key = "";
  if (typeof authorizationHeader === "string") {
    const bearerPrefix = "Bearer ";
    if (authorizationHeader.startsWith(bearerPrefix)) {
      key = authorizationHeader.substring(bearerPrefix.length);
    } else {
      throw new errors_1.ApiError(
        401,
        "Authorization header must start with Bearer",
      );
    }
  } else if (typeof apiKeyHeader === "string" && apiKeyHeader.length > 0) {
    key = apiKeyHeader;
  } else {
    throw new errors_1.ApiError(401, "API key is required");
  }
  console.log("API key:", key.red);
  // now we have key, look it up in the database
  const info = await lookupByKey(key);
  if (!info) {
    throw new errors_1.ApiError(401, "Invalid API key");
  }
  // delete the key from the object
  delete info.key;
  // store the API key info in the context
  ctx.state.apiKey = info;
  await next();
}
exports.authMiddleware = authMiddleware;
