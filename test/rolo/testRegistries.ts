import { randomString } from "@pilotmoon/chewit";
import test from "ava";
import {
  generateApiKeyToken,
  generateEncryptedToken,
} from "../../src/rolo/token.js";
import { keys, rolo } from "./setup.js";
import { testAquaticPrimeKeyPair } from "./testLicenseKeys.js";

export function uniqueId(id: string) {
  return `${id}-${uniqueSuffix}`;
}
type Registry = {
  description: string;
  identifiers: string[];
};
let uniqueSuffix: string;
let fooRegistry: Registry;
let fooRegistryId: string;
let barRegistry: Registry;
let barRegistryId: string;
let bazRegistry: Registry;
let bazRegistryId: string;

test.before(() => {
  uniqueSuffix = randomString({ length: 8 });
  fooRegistry = {
    description: "foo",
    identifiers: [uniqueId("com.example.foo")],
  };
  barRegistry = {
    description: "bar",
    identifiers: [uniqueId("com.example.bar")],
  };
  bazRegistry = {
    description: "baz",
    identifiers: [uniqueId("com.example.baz")],
  };
});

test("create registry, missing payload", async (t) => {
  const res = await rolo().post("registries", "", {
    headers: { "Content-Type": "application/json" },
  });
  t.is(res.status, 400);
});

test("create registry, no scope", async (t) => {
  const res = await rolo("noscope").post("registries", fooRegistry);
  t.is(res.status, 403);
});

test("create registry, missing identifiers array", async (t) => {
  const res = await rolo().post("registries", {
    description: "foo",
  });
  t.is(res.status, 400);
});

test("create registry, empty identifiers", async (t) => {
  const res = await rolo().post("registries", {
    description: "foo",
    identifiers: [],
  });
  t.is(res.status, 400);
});

test("create registry", async (t) => {
  const res = await rolo().post("registries", fooRegistry);
  t.is(res.status, 201);
  t.like(res.data, fooRegistry);
  t.is(res.headers.location, `/registries/${res.data.id}`);
  fooRegistryId = res.data.id;
});

test("create registry, duplicate", async (t) => {
  const res = await rolo().post("registries", fooRegistry);
  t.is(res.status, 409);
});

test("create registry, unexpected key", async (t) => {
  const res = await rolo().post("registries", {
    ...barRegistry,
    unexpected: "foo",
  });
  t.is(res.status, 400);
});

test("create registry with a secret (aquatic prime)", async (t) => {
  const res = await rolo().post("registries", {
    ...barRegistry,
    objects: {
      aquaticPrime: testAquaticPrimeKeyPair,
    },
  });
  t.is(res.status, 201);
  t.like(res.data, barRegistry);
  t.is(res.headers.location, `/registries/${res.data.id}`);
  barRegistryId = res.data.id;
});

test("get registry", async (t) => {
  const res = await rolo().get(`/registries/${fooRegistryId}`);
  t.is(res.status, 200);
  t.like(res.data, fooRegistry);
});

test("get registry, not found", async (t) => {
  const res = await rolo().get("/registries/123");
  t.is(res.status, 404);
});

test("update registry", async (t) => {
  const res = await rolo().patch(`/registries/${fooRegistryId}`, {
    description: "foo2",
  });
  fooRegistry.description = "foo2";
  t.is(res.status, 204);
  t.is(res.data, "");
});

test("update registry, not found", async (t) => {
  const res = await rolo().patch("/registries/123", { description: "123" });
  t.is(res.status, 404);
});

test("update registry, bad edition", async (t) => {
  const res = await rolo().patch(`/registries/${fooRegistryId}`, {
    edition: "foo",
  });
  t.is(res.status, 400);
});

test("update registry, violating unique constraint", async (t) => {
  // try to update bar to foo's bundleId
  const res2 = await rolo().patch(`/registries/${barRegistryId}`, {
    identifiers: [...barRegistry.identifiers, fooRegistry.identifiers[0]],
  });
  t.is(res2.status, 409);
});

test("update registry, no update access", async (t) => {
  const res = await rolo("readonly").patch(`/registries/${fooRegistryId}`, {
    description: "foo4",
  });
  t.is(res.status, 403);
});

test("add an object to the foo product that is not in the schema", async (t) => {
  const res = await rolo().patch(`/registries/${fooRegistryId}`, {
    foo: "bar",
  });
  t.is(res.status, 400);
  // check that it was not added
  const res2 = await rolo().get(`/registries/${fooRegistryId}`);
  t.is(res2.status, 200);
  t.is(res2.data.foo, undefined);
});

test("verify that foo does not have an aquaticprime key pair", async (t) => {
  const res = await rolo().get(`/registries/${fooRegistryId}`);
  t.is(res.status, 200);
  t.is(res.data.aquaticPrimeKeyPair, undefined);
});

test("add a key pair to the foo registry", async (t) => {
  // first get the foo registry
  const res = await rolo().get(`/registries/${fooRegistryId}`);

  // add the aquaticprime key pair with a new name
  const objects = { blah: testAquaticPrimeKeyPair };

  // update the foo registry
  const res2 = await rolo().patch(`/registries/${fooRegistryId}`, { objects });
  t.is(res2.status, 204);
});

test("retrieve the aquaticprime key pairs and check redacted", async (t) => {
  const res = await rolo().get(`/registries/${fooRegistryId}`);
  t.is(res.status, 200);
  t.deepEqual(res.data.objects.blah, { object: "keyPair", redacted: true });
});

test("add a key pair to the foo registry using the put endpoint", async (t) => {
  // add the aquaticprime key pair with a new name
  const res = await rolo().put(
    `/registries/${fooRegistryId}/objects/mysecret`,
    testAquaticPrimeKeyPair,
  );
  t.is(res.status, 204);

  // retrieve the aquaticprime key pairs and check private key is redacted
  const res2 = await rolo().get(`/registries/${fooRegistryId}`);
  t.is(res2.status, 200);
  t.deepEqual(res2.data.objects.mysecret, {
    object: "keyPair",
    redacted: true,
  });
});

test("try to get a secret using its own endpoint", async (t) => {
  const res = await rolo().get(`/registries/${fooRegistryId}/objects/mysecret`);
  t.is(res.status, 200);
  // this time the private key should be returned
  t.is(res.data.publicKey, testAquaticPrimeKeyPair.publicKey);
  t.is(res.data.privateKey, testAquaticPrimeKeyPair.privateKey);
});

test("try to get a secret that does not exist", async (t) => {
  const res = await rolo().get(
    `/registries/${fooRegistryId}/objects/doesnotexist`,
  );
  t.is(res.status, 404);
});

test("try to get a secret without the right permissions", async (t) => {
  const res = await rolo("updateonly").get(
    `/registries/${fooRegistryId}/objects/mysecret`,
  );
  t.is(res.status, 403);
});

test("create a registry without objects and then add one", async (t) => {
  const res = await rolo().post("/registries", bazRegistry);
  t.is(res.status, 201);
  bazRegistryId = res.data.id;

  const res2 = await rolo().put(
    `/registries/${res.data.id}/objects/mysecret`,
    testAquaticPrimeKeyPair,
  );
  t.is(res2.status, 204);

  const res3 = await rolo().get(`/registries/${res.data.id}`);
  t.is(res3.status, 200);
  t.deepEqual(res3.data.objects.mysecret, {
    object: "keyPair",
    redacted: true,
  });
});

test("list registries", async (t) => {
  const res = await rolo().get("/registries?limit=3");
  t.is(res.status, 200);
  t.is(res.data.items.length, 3);
  t.is(res.data.object, "list");
  t.like(res.data.items[0], bazRegistry);
  t.like(res.data.items[1], barRegistry);
  t.like(res.data.items[2], fooRegistry);
});

test("delete registry, not found", async (t) => {
  const res = await rolo().delete("/registries/123");
  t.is(res.status, 404);
});

test("delete a registry", async (t) => {
  const res2 = await rolo().delete(`/registries/${bazRegistryId}`);
  t.is(res2.status, 204);
  t.is(res2.data, "");
});

test("list registries again, expecting last one deleted", async (t) => {
  const res = await rolo().get("/registries?limit=1");
  t.is(res.status, 200);
  t.is(res.data.items.length, 1);
  t.is(res.data.object, "list");
  t.like(res.data.items[0], barRegistry);
});

test("add a record to the foo registry", async (t) => {
  const res = await rolo().put(`/registries/${fooRegistryId}/objects/config`, {
    object: "record",
    record: {
      foo: "bar",
    },
  });
  t.is(res.status, 204);
});

test("get the record", async (t) => {
  const res = await rolo().get(`/registries/${fooRegistryId}/objects/config`);
  t.is(res.status, 200);
  t.is(res.data.object, "record");
  t.like(res.data.record, { foo: "bar" });
});

test("add another record to the foo registry", async (t) => {
  const res = await rolo().put(`/registries/${fooRegistryId}/objects/config2`, {
    object: "record",
    record: {
      foo: "bar",
    },
  });
  t.is(res.status, 204);
});

test("get the second record", async (t) => {
  const res = await rolo().get(`/registries/${fooRegistryId}/objects/config2`);
  t.is(res.status, 200);
  t.is(res.data.object, "record");
  t.like(res.data.record, { foo: "bar" });
});

test("list the registries using a token with read permissions", async (t) => {
  // first generate a token with read permissions
  const token = generateEncryptedToken({
    keyKind: "test",
    scopes: ["registries:read"],
  });

  // now use that token to list the records
  const res = await rolo(null).get("/registries", { params: { token } });
  t.is(res.status, 200);
  t.is(res.data.object, "list");
});

test("list the registries using a token with read permissions and a resource", async (t) => {
  // first generate a token with read permissions
  const token = generateEncryptedToken({
    keyKind: "test",
    scopes: ["registries:read"],
    resource: "registries",
  });

  // now use that token to list the records
  const res = await rolo(null).get("/registries", { params: { token } });
  t.is(res.status, 200);
  t.is(res.data.object, "list");
});

// list the objects of the foo registry using a token with read permissions
test("read the foo registry using a token with read permissions and a resource", async (t) => {
  const token = generateEncryptedToken({
    keyKind: "test",
    scopes: ["registries:read"],
    resource: `registries/${fooRegistryId}`,
  });

  const res = await rolo(null).get(`/registries/${fooRegistryId}`, {
    params: { token },
  });
  t.is(res.status, 200);
  t.is(res.data.object, "registry");
});

// list the objects of the foo registry using a token with read permissions
test("read the foo registry using a token with read permissions for a different resource", async (t) => {
  const token = generateEncryptedToken({
    keyKind: "test",
    scopes: ["registries:read"],
    resource: "registries/blahblah",
  });

  const res = await rolo(null).get(`/registries/${fooRegistryId}`, {
    params: { token },
  });
  t.is(res.status, 401);
});

test("get an object from the foo registry using a token with read permissions", async (t) => {
  const token = generateEncryptedToken({
    keyKind: "test",
    scopes: ["registries:read"],
    resource: `registries/${fooRegistryId}`,
  });

  const res = await rolo(null).get(
    `/registries/${fooRegistryId}/objects/config`,
    {
      params: { token },
    },
  );
  t.is(res.status, 200);
  t.is(res.data.object, "record");
  t.like(res.data.record, { foo: "bar" });
});

test("get an object from the foo registry using a token of the api key type", async (t) => {
  const token = generateApiKeyToken(keys().runner.key);
  t.log("token", token);
  const res = await rolo(null).get(
    `/registries/${fooRegistryId}/objects/config`,
    {
      params: { token },
    },
  );
  const status = res.status;
  t.log(res.data);
  t.log("status", status);
  t.is(res.data.object, "record");
  t.like(res.data.record, { foo: "bar" });
  t.is(status, 200);
});
