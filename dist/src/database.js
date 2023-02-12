"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.close = exports.connect = exports.getDb = void 0;
const mongodb_1 = require("mongodb");
const config_1 = require("./config");
const logger_1 = require("./logger");
let client;
// Get the database connection
function getDb(kind) {
  if (!client) {
    throw new Error(
      "No database connection established. Please connect first.",
    );
  }
  switch (kind) {
    case "test":
      return client.db(config_1.config.DATABASE_NAME_TEST);
    case "live":
      return client.db(config_1.config.DATABASE_NAME_LIVE);
    default:
      throw new Error("Unknown database kind: " + kind);
  }
}
exports.getDb = getDb;
// called at startup to connect to the database
async function connect() {
  if (!client) {
    (0, logger_1.log)("Connecting to database");
    client = new mongodb_1.MongoClient(config_1.config.DATABASE_URL, {
      serverApi: mongodb_1.ServerApiVersion.v1,
    });
    await client.connect();
    (0, logger_1.log)("Connected to database".yellow, client.db().databaseName);
  }
}
exports.connect = connect;
// called at termination to close the connection
async function close() {
  if (client) {
    (0, logger_1.log)("Closing database connection");
    await client.close();
  }
}
exports.close = close;
