"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware =
  exports.deleteApiKey =
  exports.updateApiKey =
  exports.readApiKey =
  exports.createApiKey =
  exports.verifyScope =
  exports.init =
  exports.AuthContext =
  exports.PartialAuthContext =
  exports.SettableAuthContext =
    void 0;
const chewit_1 = require("@pilotmoon/chewit");
const zod_1 = require("zod");
const database_1 = require("./database");
const errors_1 = require("./errors");
const logger_1 = require("./logger");
const apiKeysCollectionName = "api_keys";
function getCollection(kind) {
  const db = (0, database_1.getDb)(kind);
  return db.collection(apiKeysCollectionName);
}
const allScopes = [
  "health:read",
  "api_keys:create",
  "api_keys:read",
  "api_keys:update",
  "api_keys:delete",
];
// schema for API keys
exports.SettableAuthContext = zod_1.z.object({
  scopes: zod_1.z.array(zod_1.z.enum(allScopes)),
  description: zod_1.z.string(),
});
exports.PartialAuthContext = exports.SettableAuthContext.partial();
exports.AuthContext = exports.SettableAuthContext.extend({
  kind: zod_1.z.enum(["test", "live"]),
});
const ApiKeySchema = exports.AuthContext.extend({
  _id: zod_1.z.string(),
  object: zod_1.z.literal("api_key"),
  key: zod_1.z.string(),
});
// called at startup to set the collection index
async function init() {
  (0, logger_1.log)(`init ${apiKeysCollectionName} collection`);
  // set for both test and live database
  for (const kind of ["test", "live"]) {
    const db = (0, database_1.getDb)(kind);
    const collection = db.collection(apiKeysCollectionName);
    const result = await collection.createIndex({ key: 1 }, { unique: true });
    (0, logger_1.log)(
      "createIndex",
      db.databaseName,
      apiKeysCollectionName,
      result,
    );
    // count documents in collection
    const count = await collection.countDocuments();
    if (count == 0) {
      (0, logger_1.log)("No API keys found, creating bootstrap key", kind.blue);
      // create an api key to bootstrap the system
      const authContext = {
        kind,
        scopes: allScopes,
        description: "bootstrap key",
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
// create a new API key. returns the new key
async function createApiKey(params, authContext) {
  await verifyScope("api_keys:create", authContext);
  const document = {
    _id: `ak_${(0, chewit_1.randomString)()}`,
    object: "api_key",
    created: new Date(),
    key: `key_${authContext.kind}_${(0, chewit_1.randomString)()}`,
    kind: authContext.kind,
    ...params,
  };
  const result = await getCollection(authContext.kind).insertOne(document);
  (0, logger_1.log)(`Inserted API key with _id: ${result.insertedId}`);
  return document;
}
exports.createApiKey = createApiKey;
// return an API key by its ID. returns null if the key does not exist
async function readApiKey(id, authContext) {
  await verifyScope("api_keys:read", authContext);
  return await getCollection(authContext.kind).findOne({ _id: id });
}
exports.readApiKey = readApiKey;
// update updatable fields of an API key and return the updated document
// returns null if the key does not exist
async function updateApiKey(id, params, authContext) {
  await verifyScope("api_keys:update", authContext);
  const result = await getCollection(authContext.kind).findOneAndUpdate({
    _id: id,
  }, {
    $set: params,
    $currentDate: {
      modified: true,
    },
  }, {
    returnDocument: "after",
  });
  return result.value;
}
exports.updateApiKey = updateApiKey;
// delete an API key by its ID. returns true if the key was deleted
async function deleteApiKey(id, authContext) {
  await verifyScope("api_keys:delete", authContext);
  const result = await getCollection(authContext.kind).deleteOne({ _id: id });
  return result.deletedCount === 1;
}
exports.deleteApiKey = deleteApiKey;
// auth middleware, allow Bearer token or x-api-key header
async function authMiddleware(ctx, next) {
  const prefix = "Bearer ";
  const authorization = ctx.request.headers["authorization"];
  let key = "";
  if (typeof authorization === "string") {
    if (authorization.startsWith(prefix)) {
      key = authorization.substring(prefix.length);
    } else {
      throw new errors_1.ApiError(401, "Bearer token is required");
    }
  } else {
    throw new errors_1.ApiError(401, "API key is required");
  }
  // regex match the kind part of the key
  const match = key.match(/^key_(test|live)_/);
  if (!match) {
    throw new errors_1.ApiError(401, "Invalid API key prefix");
  }
  const kind = match[1];
  // now we have key, look it up in the database
  const document = await getCollection(kind).findOne({ key: key });
  if (!document) {
    throw new errors_1.ApiError(401, "Invalid API key");
  }
  (0, logger_1.log)("API key ID:", document._id.blue);
  ctx.state.apiKeyId = document._id;
  // validate and store the document as the auth context
  try {
    const authContext = exports.AuthContext.parse(document);
    //log("Auth context:", JSON.stringify(authContext).blue);
    (0, logger_1.log)("Scopes:", authContext.scopes.join(", ").blue);
    ctx.state.auth = authContext;
  } catch (err) {
    (0, logger_1.loge)("Error parsing auth context", err);
    throw new errors_1.ApiError(500, "Error parsing auth context");
  }
  await next();
}
exports.authMiddleware = authMiddleware;
