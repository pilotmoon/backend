"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAppClose = exports.getDb = exports.connect = void 0;
const mongodb_1 = require("mongodb");
const config_1 = require("./config");
let client;
// Connect to the database
async function connect() {
  if (!client) {
    console.log("Connecting to database");
    client = new mongodb_1.MongoClient(config_1.config.DATABASE_URL, {
      serverApi: mongodb_1.ServerApiVersion.v1,
    });
    await client.connect();
  }
}
exports.connect = connect;
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
// called at termination to close the connection
async function onAppClose() {
  if (client) {
    console.log("Closing database connection");
    await client.close();
  }
}
exports.onAppClose = onAppClose;
