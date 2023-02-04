"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testDb = void 0;
const mongodb_1 = require("mongodb");
const config_1 = require("./config");
// database test
async function testDb() {
  const client = new mongodb_1.MongoClient(config_1.DATABASE_URL, {
    serverApi: mongodb_1.ServerApiVersion.v1,
  });
  try {
    const database = client.db("testdb");
    const movies = database.collection("movies");
    const document = { title: "Dune" };
    const movie = await movies.insertOne(document);
    console.log(movie);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
exports.testDb = testDb;
