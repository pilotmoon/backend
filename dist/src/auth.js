"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware =
  exports.lookupById =
  exports.createApiKey =
  exports.init =
  exports.AuthContext =
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
exports.AuthContext = zod_1.z.object({
  scopes: zod_1.z.array(zod_1.z.enum(allScopes)),
  kind: zod_1.z.enum(["test", "live"]),
  metadata: zod_1.z.record(zod_1.z.string().min(1), zod_1.z.any()).optional(),
});
const ApiKeySchema = exports.AuthContext.extend({
  _id: zod_1.z.string(),
  object: zod_1.z.literal("api_key"),
  key: zod_1.z.string().optional(),
  created: zod_1.z.date(),
});
// called at startup to set the collection index
async function init() {
  console.log(`init ${apiKeysCollectionName} collection`);
  // set for both test and live database
  for (const kind of ["test", "live"]) {
    const db = (0, database_1.getDb)(kind);
    const result = await db
      .collection(apiKeysCollectionName)
      .createIndex({ key: 1 }, { unique: true });
    console.log("createIndex", db.databaseName, apiKeysCollectionName, result);
  }
}
exports.init = init;
// create a new API key
async function createApiKey(params, authContext) {
  const document = {
    _id: `ak_${(0, chewit_1.randomString)()}`,
    object: "api_key",
    created: new Date(),
    key: `key_${params.kind}_${(0, chewit_1.randomString)()}`,
    ...params,
  };
  const collection = (0, database_1.getDb)(authContext.kind).collection(
    apiKeysCollectionName,
  );
  const result = await collection.insertOne(document);
  console.log(`Inserted API key with _id: ${result.insertedId}`);
  return document;
}
exports.createApiKey = createApiKey;
// get an API key by id
async function lookupById(id, authContext) {
  const collection = (0, database_1.getDb)(authContext.kind).collection(
    apiKeysCollectionName,
  );
  const result = await collection.findOne({ _id: id });
  if (result) {
    delete result.key; // don't return the secret key itself
  }
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
  // regex match the kind part of the key
  const match = key.match(/^key_(test|live)_/);
  if (!match) {
    throw new errors_1.ApiError(401, "Invalid API key prefix");
  }
  let keyKind = match[1];
  console.log("API key kind:", keyKind.blue);
  // now we have key, look it up in the database
  const collection = (0, database_1.getDb)(keyKind).collection(
    apiKeysCollectionName,
  );
  const document = await collection.findOne({ key: key });
  if (!document) {
    throw new errors_1.ApiError(401, "Unknown API key");
  }
  // store the info for the rest of the app to access
  const authContext = exports.AuthContext.parse(document);
  console.log("Auth context:", JSON.stringify(authContext).blue);
  ctx.state.auth = authContext;
  await next();
}
exports.authMiddleware = authMiddleware;
