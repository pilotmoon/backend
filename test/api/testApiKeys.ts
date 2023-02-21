import test from "ava";
import { keys, rolo } from "./setup";
import { randomString } from "@pilotmoon/chewit";
import { config } from "../../src/config";

test("missing api key", async (t) => {
  const res = await rolo().get("health", {
    headers: { "Authorization": null },
  });
  t.is(res.status, 401);
});

test("bad auth key format", async (t) => {
  const res = await rolo().get("health", {
    headers: { "Authorization": "blah blah" },
  });
  t.is(res.status, 401);
});

test("unknown api key", async (t) => {
  const res = await rolo().get("health", {
    headers: { "Authorization": "Bearer blah blah" },
  });
  t.is(res.status, 401);
});

test("create api key, missing payload", async (t) => {
  const res = await rolo().post("apiKeys", "", {
    headers: { "Content-Type": "application/json" },
  });
  t.is(res.status, 400);
});

test("create api key, form encoded", async (t) => {
  const res = await rolo().post(
    "apiKeys",
    new URLSearchParams({ foo: "bar" }),
  );
  t.is(res.status, 415);
});

test("create api key, string", async (t) => {
  const res = await rolo().post(
    "apiKeys",
    "foo",
  );
  t.is(res.status, 415);
});

test("create api key, empty object", async (t) => {
  const res = await rolo().post("apiKeys", {});
  t.is(res.status, 400);
});

test("create api key, unknown scope", async (t) => {
  const res = await rolo().post("apiKeys", {
    scopes: ["foo"],
  });
  t.is(res.status, 400);
});

test("api key, method not allowed (get)", async (t) => {
  const res = await rolo().get("apiKeys");
  t.is(res.status, 405);
});

test("api key CRUD test", async (t) => {
  // create new key
  const res = await rolo().post("apiKeys", {
    scopes: [],
    description: "crud test key",
    blah: "blah",
  });
  t.is(res.status, 201);
  t.assert(res.data.key.length > 0);
  t.is(res.data.description, "crud test key");
  t.is(res.data.blah, undefined);
  const location = res.headers["location"];
  t.assert(location.startsWith(config.APP_URL));
  t.log(location);

  // get the key
  const res2 = await rolo().get(location);
  t.is(res2.status, 200);
  t.like(res2.data, {
    scopes: [],
    description: "crud test key",
  });
  t.is(res2.status, 200);
  t.assert(res2.data.id.length > 0);
  t.is(res2.data.key, undefined);
  t.assert(!res2.data.scopes.includes("apiKeys:read"));

  // update the key
  const res3 = await rolo().patch(location, {
    description: "crud test key updated",
  });
  t.is(res3.status, 204);
  t.is(res3.data, "");

  // get the key again to check update
  const res4 = await rolo().get(location);
  t.is(res4.status, 200);
  t.like(res4.data, {
    scopes: [],
    description: "crud test key updated",
  });
  t.is(res4.status, 200);

  // delete the key
  const res5 = await rolo().delete(location);
  t.is(res5.status, 204);
  t.is(res5.data, "");

  // get the key again
  const res6 = await rolo().get(location);
  t.is(res6.status, 404);
});

test("get current api key", async (t) => {
  const res = await rolo().get("apiKeys/current");
  t.is(res.status, 200);
  t.like(res.data, {
    id: keys().runner.id,
    kind: "test",
  });
  t.assert(res.data.id.length > 0);
  t.is(res.data.key, undefined);
});

test("head current api key", async (t) => {
  const res = await rolo().head("apiKeys/current");
  t.is(res.status, 200);
  t.is(res.data, "");
  t.is(res.headers["content-type"], "application/json; charset=utf-8");
  t.log("content-length", res.headers["content-length"]);
});

test("modify current api key", async (t) => {
  const res = await rolo().patch("apiKeys/current", { "description": "foo" });
  t.is(res.status, 405);
});

test("delete current api key", async (t) => {
  const res = await rolo().delete("apiKeys/current");
  t.is(res.status, 405);
});

test("options current api key", async (t) => {
  const res = await rolo().options("apiKeys/current");
  t.is(res.status, 200);
  const allow = res.headers["allow"].split(", ").sort();
  t.deepEqual(allow, ["GET", "HEAD"]);
});

test("options current api key by id", async (t) => {
  const res = await rolo().options(
    "apiKeys/" + keys().runner.id,
  );
  t.is(res.status, 200);
  const allow = res.headers["allow"].split(", ").sort();
  t.deepEqual(allow, ["DELETE", "GET", "HEAD", "PATCH"]);
});

test("delete current api key by id", async (t) => {
  const res = await rolo().delete(
    "apiKeys/" + keys().runner.id,
  );
  t.is(res.status, 400);
});

test("modify current api key by id", async (t) => {
  const res = await rolo().patch(
    "apiKeys/" + keys().runner.id,
    { "description": "foo" },
  );
  t.is(res.status, 400);
});

test("modify other api key by id", async (t) => {
  const str = "random " + randomString({ length: 10 });
  const res = await rolo().patch(
    "apiKeys/" + keys().subject.id,
    { "description": str },
  );
  t.is(res.status, 204);
});
