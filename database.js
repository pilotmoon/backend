"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testDb = void 0;
const mongoose_1 = require("mongoose");
const config_1 = require("./config");
// database test
async function testDb() {
  mongoose_1.default.set("strictQuery", false);
  await mongoose_1.default.connect(config_1.DATABASE_URL, {
    dbName: config_1.DATABASE_NAME,
  });
  console.log("ok");
  const Cat = mongoose_1.default.model("Cat", { name: String });
  const kitty = new Cat({ name: "Boris" });
  kitty.save().then(() => console.log("meow"));
}
exports.testDb = testDb;
