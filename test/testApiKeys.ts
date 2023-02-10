import test from "ava";
import { rolo } from "./setup";

test("missing payload", async (t) => {
  const res = await rolo().post("api_keys");
  t.is(res.status, 400);
  t.assert(res.data.error.message.length > 0);
});
