import mongoose from "mongoose";
import { DATABASE_NAME, DATABASE_URL } from "./config";

// database test
export async function testDb(): Promise<void> {
  mongoose.set("strictQuery", false);
  await mongoose.connect(DATABASE_URL, { dbName: DATABASE_NAME });
  console.log("ok");
  const Cat = mongoose.model<any>("Cat", { name: String });
  const kitty = new Cat({ name: "Boris" });
  kitty.save().then(() => console.log("meow"));
}
