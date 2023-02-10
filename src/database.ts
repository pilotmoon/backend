import { DATABASE_NAME, DATABASE_URL } from "./config";
import { Db, MongoClient, ServerApiVersion } from "mongodb";
import _ = require("lodash");

let client: MongoClient;

// Close the database connection when the process is terminated
process.on("SIGINT", function () {
  console.log("Closing database connection");
  if (client) {
    client.close();
  }
});

// Connect to the database
export async function connect() {
  if (!client) {
    console.log("Connecting to database");
    client = new MongoClient(DATABASE_URL, {
      serverApi: ServerApiVersion.v1,
    });
    await client.connect();
  }
}

// Get the database connection
export function getDb(name: string = DATABASE_NAME): Db {
  if (!client) {
    throw new Error(
      "No database connection established. Please connect first.",
    );
  }
  return client.db(name);
}

export function cleanDocument<T extends object>(doc: T) {
  return _.omit(doc, ["_id"]) as T;
}
