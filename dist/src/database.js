"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanDocument = exports.getDb = exports.connect = void 0;
const config_1 = require("./config");
const mongodb_1 = require("mongodb");
const _ = require("lodash");
let client;
// Close the database connection when the process is terminated
process.on("SIGINT", function () {
  console.log("Closing database connection");
  if (client) {
    client.close();
  }
});
// Connect to the database
async function connect() {
  if (!client) {
    console.log("Connecting to database");
    client = new mongodb_1.MongoClient(config_1.DATABASE_URL, {
      serverApi: mongodb_1.ServerApiVersion.v1,
    });
    await client.connect();
  }
}
exports.connect = connect;
// Get the database connection
function getDb(name = config_1.DATABASE_NAME) {
  if (!client) {
    throw new Error(
      "No database connection established. Please connect first.",
    );
  }
  return client.db(name);
}
exports.getDb = getDb;
function cleanDocument(doc) {
  return _.omit(doc, ["_id"]);
}
exports.cleanDocument = cleanDocument;
