import { Db, MongoClient, ServerApiVersion } from "mongodb";
import { config } from "./config";
import { log } from "./logger";
import { KeyKind } from "./identifiers";

let client: MongoClient;

// Get the database connection
export function getDb(kind: KeyKind): Db {
  if (!client) {
    throw new Error(
      "No database connection established. Please connect first.",
    );
  }
  switch (kind) {
    case "test":
      return client.db(config.DATABASE_NAME_TEST);
    case "live":
      return client.db(config.DATABASE_NAME_LIVE);
    default:
      throw new Error("Unknown database kind: " + kind);
  }
}

// called at startup to connect to the database
export async function connect() {
  if (!client) {
    log("Connecting to database");
    client = new MongoClient(config.DATABASE_URL, {
      serverApi: ServerApiVersion.v1,
    });
    await client.connect();
    log("Connected to database".green, client.db().databaseName);
  }
}

// called at termination to close the connection
export async function close() {
  if (client) {
    log("Closing database connection");
    await client.close();
  }
}
