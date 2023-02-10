"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.close = exports.connect = exports.getDb = void 0;
const mongodb_1 = require("mongodb");
const config_1 = require("./config");
let client;
// Get the database connection
function getDb(name = config_1.config.DATABASE_NAME) {
  if (!client) {
    throw new Error(
      "No database connection established. Please connect first.",
    );
  }
  return client.db(name);
}
exports.getDb = getDb;
// called at startup to connect to the database
async function connect() {
  if (!client) {
    console.log("Connecting to database");
    client = new mongodb_1.MongoClient(config_1.config.DATABASE_URL, {
      serverApi: mongodb_1.ServerApiVersion.v1,
    });
    await client.connect();
    console.log("Connected to database".yellow, client.db().databaseName);
  }
}
exports.connect = connect;
// called at termination to close the connection
async function close() {
  if (client) {
    console.log("Closing database connection");
    await client.close();
  }
}
exports.close = close;
