"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chewit_1 = require("@pilotmoon/chewit");
const Koa = require("koa");
const config_1 = require("./config");
const database_1 = require("./database");
main().catch((err) => {
  console.log("caught error in main, rethrowing");
  throw err;
});
async function main() {
  await (0, database_1.testDb)();
}
// koa
const app = new Koa();
app.use((ctx) => {
  ctx.body = "Hello World, from koa. " + (0, chewit_1.randomString)();
});
app.listen(config_1.APP_PORT);
