import test from "ava";
import { rolo } from "./setup";
import { randomString } from "@pilotmoon/chewit";

function bundleId(id: string) {
  return id + "-" + uniqueSuffix;
}
let uniqueSuffix: string;
let fooRegistry: any;
let fooRegistryId: string;
let barRegistry: any;
let barRegistryId: string;

const testAquaticPrimeKeyPair = {
  publicKey:
    "BD199F701AB2982D6A38EC07B1AC95B6B5E10AD1692A655496AC8C70DCE086B0909ACA1A8462DBC8E906BD883770EC4D262FBC0FA6C369F39DBC167718F73EE0969CC6EEE7517F1DD5BCC80AB0030ADC0D3A82F8F3B803767EDEF87B616B6D94854DAA5A7D59A73B1F01EC0D15D50BD6D8D5A4A596EE63A88ED1F07450B22C89",
  privateKey:
    "7E1114F56721BAC8F17B4805211DB9247940B1E0F0C6EE386473084B3DEB0475B5BC86BC5841E7DB46047E5ACFA09D88C41FD2B519D79BF7BE7D644F65FA29E9E9AFDC9AF918D1870264F8CCDDD1BEF46359582C3A18BC5E138121D6C9FF60AFBCA679F165B826D27A778348A11CBDF66F91651F91FE52B0EC7BA9B590266E63",
  keyFormat: "hex",
  object: "keyPair",
};

test.before(() => {
  uniqueSuffix = randomString({ length: 8 });
  fooRegistry = {
    description: "foo",
    identifiers: [bundleId("com.example.foo")],
  };
  barRegistry = {
    description: "bar",
    identifiers: [bundleId("com.example.bar")],
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

test("create registry, aquatic prime", async (t) => {
  const res = await rolo().post("registries", {
    ...barRegistry,
    secrets: {
      "aquaticPrime": testAquaticPrimeKeyPair,
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

test("list registries", async (t) => {
  const res = await rolo().get("/registries?limit=2");
  t.is(res.status, 200);
  t.is(res.data.items.length, 2);
  t.is(res.data.object, "list");
  t.like(res.data.items[1], fooRegistry);
  t.like(res.data.items[0], barRegistry);
});

test("add an object to the foo prduct that is not in the schema", async (t) => {
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
  const secrets = { blah: testAquaticPrimeKeyPair };

  // update the foo registry
  const res2 = await rolo().patch(`/registries/${fooRegistryId}`, { secrets });
  t.is(res2.status, 204);
});

test("retrieve the aquaticprime key pairs and check private key is redacted", async (t) => {
  const res = await rolo().get(`/registries/${fooRegistryId}`);
  t.is(res.status, 200);
  t.is(
    res.data.secrets.blah.publicKey,
    testAquaticPrimeKeyPair.publicKey,
  );
  t.deepEqual(res.data.secrets.blah.privateKey, undefined);
  t.is(res.data.secrets.blah.redacted, true);
});

test("add a key pair to the foo registry using the put endpoint", async (t) => {
  // add the aquaticprime key pair with a new name
  const res = await rolo().put(
    `/registries/${fooRegistryId}/secrets/mysecret`,
    testAquaticPrimeKeyPair,
  );
  t.is(res.status, 204);

  // retrieve the aquaticprime key pairs and check private key is redacted
  const res2 = await rolo().get(`/registries/${fooRegistryId}`);
  t.is(res2.status, 200);
  t.is(res2.data.secrets.mysecret.publicKey, testAquaticPrimeKeyPair.publicKey);
  t.deepEqual(res2.data.secrets.mysecret.privateKey, undefined);
  t.is(res2.data.secrets.mysecret.redacted, true);
});

test("try top get a secret using its own endpoint", async (t) => {
  const res = await rolo().get(`/registries/${fooRegistryId}/secrets/mysecret`);
  t.is(res.status, 200);
  // this time the private key should be returned
  t.is(res.data.publicKey, testAquaticPrimeKeyPair.publicKey);
  t.is(res.data.privateKey, testAquaticPrimeKeyPair.privateKey);
});

test("try to get a secret that does not exist", async (t) => {
  const res = await rolo().get(
    `/registries/${fooRegistryId}/secrets/doesnotexist`,
  );
  t.is(res.status, 404);
});

test("try to get a secret withou the right permissions", async (t) => {
  const res = await rolo("readonly").get(
    `/registries/${fooRegistryId}/secrets/mysecret`,
  );
  t.is(res.status, 403);
});

test("create a registry without secrets and then add one", async (t) => {
  const res = await rolo().post("/registries", {
    description: "baz",
    identifiers: [bundleId("com.example.baz")],
  });
  t.is(res.status, 201);

  const res2 = await rolo().put(
    `/registries/${res.data.id}/secrets/mysecret`,
    testAquaticPrimeKeyPair,
  );
  t.is(res2.status, 204);

  const res3 = await rolo().get(`/registries/${res.data.id}`);
  t.is(res3.status, 200);
  t.is(res3.data.secrets.mysecret.publicKey, testAquaticPrimeKeyPair.publicKey);
  t.deepEqual(res3.data.secrets.mysecret.privateKey, undefined);
});

test("delete registry", async (t) => {
  const res2 = await rolo().delete(`/registries/${barRegistryId}`);
  t.is(res2.status, 204);
  t.is(res2.data, "");
});

test("delete registry, not found", async (t) => {
  const res = await rolo().delete("/registries/123");
  t.is(res.status, 404);
});
