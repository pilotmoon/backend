"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware =
  exports.readApiKey =
  exports.createApiKey =
  exports.verifyScope =
  exports.init =
  exports.AuthContext =
    void 0;
const chewit_1 = require("@pilotmoon/chewit");
const zod_1 = require("zod");
const database_1 = require("./database");
const errors_1 = require("./errors");
const apiKeysCollectionName = "api_keys";
const allScopes = [
  "api_keys:create",
  "api_keys:read",
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
  key: zod_1.z.string(),
  created: zod_1.z.date(),
});
// called at startup to set the collection index
async function init() {
  console.log(`init ${apiKeysCollectionName} collection`);
  // set for both test and live database
  for (const kind of ["test", "live"]) {
    const db = (0, database_1.getDb)(kind);
    const collection = db.collection(apiKeysCollectionName);
    const result = await collection.createIndex({ key: 1 }, { unique: true });
    console.log("createIndex", db.databaseName, apiKeysCollectionName, result);
    // count documents in collection
    const count = await collection.countDocuments();
    if (count == 0) {
      console.log("No API keys found, creating bootstrap key", kind.blue);
      // create an api key to bootstrap the system
      const authContext = {
        kind,
        scopes: allScopes,
        metadata: { description: "bootstrap key" },
      };
      await createApiKey(authContext, authContext);
    }
  }
}
exports.init = init;
// function for verifying whether the auth context has a given scope
async function verifyScope(scope, authContext) {
  if (!authContext.scopes.includes(scope)) {
    throw new errors_1.ApiError(403, "Missing required scope: " + scope);
  }
}
exports.verifyScope = verifyScope;
// create a new API key
async function createApiKey(params, authContext) {
  await verifyScope("api_keys:create", authContext);
  if (params.kind !== authContext.kind) {
    throw new errors_1.ApiError(
      403,
      "Cannot create API key for different database",
    );
  }
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
async function readApiKey(id, authContext) {
  await verifyScope("api_keys:read", authContext);
  const collection = (0, database_1.getDb)(authContext.kind).collection(
    apiKeysCollectionName,
  );
  const result = await collection.findOne({ _id: id });
  return result;
}
exports.readApiKey = readApiKey;
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
  const kind = match[1];
  console.log("API key kind:", kind.blue);
  // now we have key, look it up in the database
  const collection = (0, database_1.getDb)(kind).collection(
    apiKeysCollectionName,
  );
  const document = await collection.findOne({ key: key });
  if (!document) {
    throw new errors_1.ApiError(401, "Unknown API key");
  }
  // validate and store the document as the auth context
  try {
    const authContext = exports.AuthContext.parse(document);
    console.log("Auth context:", JSON.stringify(authContext).blue);
    ctx.state.auth = authContext;
  } catch (err) {
    console.error("Error parsing auth context", err);
    throw new errors_1.ApiError(500, "Error parsing auth context");
  }
  await next();
}
exports.authMiddleware = authMiddleware;
