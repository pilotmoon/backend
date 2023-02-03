"use strict";

const Koa = require("koa");
const app = new Koa();

// Start function
const test_db = async function() {
  const mongoose = require("mongoose");
  mongoose.set('strictQuery', false);
  await mongoose.connect(process.env.DATABASE_URL, { dbName: "testdb" });  
  mongoose.connection.useDb("testdb");
  const Cat = mongoose.model("Cat", { name: String });
  const kitty = new Cat({ name: "Anton" });
  kitty.save().then(() => console.log("meow"));
}

test_db();

app.use((ctx) => {
  ctx.body = "Hello World, from koa.";
});

app.listen(1234);
