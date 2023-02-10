import { Db, MongoClient, ServerApiVersion } from "mongodb";
import { config } from "./config";

let client: MongoClient;

// Connect to the database
export async function connect() {
  if (!client) {
    console.log("Connecting to database");
    client = new MongoClient(config.DATABASE_URL, {
      serverApi: ServerApiVersion.v1,
    });
    await client.connect();
  }
}

// Get the database connection
export function getDb(name: string = config.DATABASE_NAME): Db {
  if (!client) {
    throw new Error(
      "No database connection established. Please connect first.",
    );
  }
  return client.db(name);
}

// called at termination to close the connection
export async function onAppClose() {
  if (client) {
    console.log("Closing database connection");
    await client.close();
  }
}
