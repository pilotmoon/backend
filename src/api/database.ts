import { Db, MongoClient, ServerApiVersion } from "mongodb";
import { log } from "../logger.js";
import { AuthKind } from "./auth.js";
import { config } from "./config.js";

let client: MongoClient;

// Get the database connection
export function getDb(kind: AuthKind | "logs"): Db {
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
    case "logs":
      return client.db(config.DATABASE_NAME_LOGS);
    default:
      throw new Error(`Unknown database kind: ${kind}`);
  }
}

// called at startup to connect to the database
export async function connect() {
  if (!client) {
    log("Connecting to database...");
    client = new MongoClient(config.DATABASE_URL, {
      serverApi: ServerApiVersion.v1,
    });
    client.on("close", (event: unknown): void => {
      log("Database connection closed (close)", event);
    });
    client.on("timeout", (event: unknown): void => {
      log("Database connection timed out (timeout)", event);
    });
    client.on("error", (event: unknown): void => {
      log(`Database connection error: ${event}`);
    });
    client.on("serverClosed", (event: unknown): void => {
      log("Database connection closed (serverClosed)", event);
    });
    client.on("serverOpening", (event: unknown): void => {
      log("Database connection opening (serverOpening)", event);
    });
    await client.connect();
    log("Connected to database".green, client.db().databaseName);

    // drop the test database
    log("Dropping test database");
    await getDb("test").dropDatabase();
  }
}

// called at termination to close the connection
export async function close() {
  if (client) {
    log("Closing database connection");
    await client.close();
  }
}
