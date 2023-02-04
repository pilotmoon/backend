import { MongoClient, ServerApiVersion } from "mongodb";
import { DATABASE_NAME, DATABASE_URL } from "./config";

// database test
export async function testDb(): Promise<void> {
  const client = new MongoClient(DATABASE_URL, {
    serverApi: ServerApiVersion.v1,
  });
  try {
    const database = client.db("testdb");
    const movies = database.collection("movies");
    const document = { title: "Ghostbusters" };
    const movie = await movies.insertOne(document);
    console.log(movie);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
