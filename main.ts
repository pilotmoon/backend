import { randomString } from "@pilotmoon/chewit";
import Koa = require("koa");
import { APP_PORT } from "./config";
import { testDb } from "./database";

main().catch((err) => {
  console.log("caught error in main, rethrowing");
  throw err;
});

async function main() {
  await testDb();
}

// koa
const app = new Koa();
app.use((ctx) => {
  ctx.body = "Hello World, from koa. " + randomString();
});
app.listen(APP_PORT);
