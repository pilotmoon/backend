import test from "ava";
import { keys, rolo } from "./setup";
import { randomString } from "@pilotmoon/chewit";

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

test("api keys, method not allowed (delete)", async (t) => {
  const res = await rolo().delete("apiKeys");
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
  t.is(location, "/apiKeys/" + res.data.id);
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
  t.is(res3.status, 200);
  t.is(res3.data.description, "crud test key updated");

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
  t.is(res.status, 200);
  t.is(res.data.description, str);
});

test("modify other api key by id, no read scope", async (t) => {
  const res = await rolo("updateonly").patch(
    "apiKeys/" + keys().subject.id,
    { "description": "foo" },
  );
  t.is(res.status, 204);
  t.is(res.data, "");
});

test("modify other api key by id, no write scope", async (t) => {
  const res = await rolo("readonly").patch(
    "apiKeys/" + keys().subject.id,
    { "description": "foo" },
  );
  t.is(res.status, 403);
});

test("list api keys", async (t) => {
  const res = await rolo().get("apiKeys?limit=4");
  t.is(res.data.object, "list");
  t.is(res.status, 200);
  t.is(res.data.items.length, 4);
  t.deepEqual(res.data.paginate, { limit: 4, offset: 0, order: -1 });
  t.is(res.data.items[0].key, undefined);
  t.is(res.data.items[0].id, keys()["readonly"].id);
});

test("list api keys, no read scope", async (t) => {
  const res = await rolo("updateonly").get("apiKeys?limit=4");
  t.is(res.status, 403);
});

test("list api keys, limit zero", async (t) => {
  const res = await rolo().get("apiKeys?limit=0");
  t.is(res.status, 400);
});

test("list api keys, limit negative", async (t) => {
  const res = await rolo().get("apiKeys?limit=-1");
  t.is(res.status, 400);
});

test("list api keys, limit too large", async (t) => {
  const res = await rolo().get("apiKeys?limit=1000");
  t.is(res.status, 200);
  t.is(res.data.paginate.limit, 100);
});

test("list api keys, offset negative", async (t) => {
  const res = await rolo().get("apiKeys?offset=-1");
  t.is(res.status, 400);
});

test("list api keys, offset too large", async (t) => {
  const res = await rolo().get("apiKeys?offset=10000");
  t.is(res.data.object, "list");
  t.is(res.status, 200);
  t.is(res.data.items.length, 0);
});

test("list api keys, order ascending", async (t) => {
  const res = await rolo().get("apiKeys?order=1");
  t.is(res.data.object, "list");
  t.is(res.status, 200);
  t.deepEqual(res.data.paginate, { limit: 10, offset: 0, order: 1 });
});

test("list api keys, order invalid", async (t) => {
  const res = await rolo().get("apiKeys?order=2");
  t.is(res.status, 400);
  const res2 = await rolo().get("apiKeys?order=a");
  t.is(res2.status, 400);
});

test("list api keys, limit invalid", async (t) => {
  const res = await rolo().get("apiKeys?limit=a");
  t.is(res.status, 400);
});

test("list api keys, offset invalid", async (t) => {
  const res = await rolo().get("apiKeys?offset=a");
  t.is(res.status, 400);
});

test("list api keys, limit and offset", async (t) => {
  const res = await rolo().get("apiKeys?limit=3&offset=2");
  t.is(res.data.object, "list");
  t.is(res.status, 200);
  t.is(res.data.items.length, 3);
  t.deepEqual(res.data.paginate, { limit: 3, offset: 2, order: -1 });
  t.is(res.data.items[0].id, keys()["subject"].id);
  t.is(res.data.items[1].id, keys()["noscope"].id);
  t.is(res.data.items[2].id, keys()["runner"].id);
});

test("list api keys, duplicated limit", async (t) => {
  const res = await rolo().get("apiKeys?limit=3&limit=4");
  t.is(res.status, 400);
});
