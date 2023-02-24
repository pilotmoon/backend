import test from "ava";
import { keys, rolo } from "./setup";
import { randomString } from "@pilotmoon/chewit";

function bundleId(id: string) {
  return id + "-" + uniqueSuffix;
}
let uniqueSuffix: string;
let fooProduct: any;
let fooProductId: string;
let barProduct: any;
let barProductId: string;

const testAquaticPrimeKeyPair = {
  publicKey:
    "BD199F701AB2982D6A38EC07B1AC95B6B5E10AD1692A655496AC8C70DCE086B0909ACA1A8462DBC8E906BD883770EC4D262FBC0FA6C369F39DBC167718F73EE0969CC6EEE7517F1DD5BCC80AB0030ADC0D3A82F8F3B803767EDEF87B616B6D94854DAA5A7D59A73B1F01EC0D15D50BD6D8D5A4A596EE63A88ED1F07450B22C89",
  privateKey:
    "7E1114F56721BAC8F17B4805211DB9247940B1E0F0C6EE386473084B3DEB0475B5BC86BC5841E7DB46047E5ACFA09D88C41FD2B519D79BF7BE7D644F65FA29E9E9AFDC9AF918D1870264F8CCDDD1BEF46359582C3A18BC5E138121D6C9FF60AFBCA679F165B826D27A778348A11CBDF66F91651F91FE52B0EC7BA9B590266E63",
  keyFormat: "hex",
};

test.before(() => {
  uniqueSuffix = randomString({ length: 8 });
  fooProduct = {
    name: "foo",
    bundleId: bundleId("com.example.foo"),
    edition: "standalone",
  };
  barProduct = {
    name: "bar",
    bundleId: bundleId("com.example.bar"),
    edition: "standalone",
  };
});

test("create product, missing payload", async (t) => {
  const res = await rolo().post("products", "", {
    headers: { "Content-Type": "application/json" },
  });
  t.is(res.status, 400);
});

test("create product, no scope", async (t) => {
  const res = await rolo("noscope").post("products", fooProduct);
  t.is(res.status, 403);
});

test("create product, bad edition", async (t) => {
  const res = await rolo().post("products", {
    name: "foo",
    bundleId: "com.example.foo",
    edition: "foo",
  });
  t.is(res.status, 400);
});

test("create product", async (t) => {
  const res = await rolo().post("products", fooProduct);
  t.is(res.status, 201);
  t.like(res.data, fooProduct);
  t.is(res.headers.location, `/products/${res.data.id}`);
  fooProductId = res.data.id;
});

test("create product, duplicate", async (t) => {
  const res = await rolo().post("products", fooProduct);
  t.is(res.status, 409);
});

test("create product, unexpected key", async (t) => {
  const res = await rolo().post("products", {
    ...barProduct,
    unexpected: "foo",
  });
  t.is(res.status, 400);
});

test("create product, aquatic prime", async (t) => {
  const res = await rolo().post("products", {
    ...barProduct,
    aquaticPrimeKeyPair: testAquaticPrimeKeyPair,
  });
  t.is(res.status, 201);
  t.like(res.data, barProduct);
  t.like(res.data.aquaticPrimeKeyPair, testAquaticPrimeKeyPair);
  t.is(res.headers.location, `/products/${res.data.id}`);
  barProductId = res.data.id;
});

test("get product", async (t) => {
  const res = await rolo().get(`/products/${fooProductId}`);
  t.is(res.status, 200);
  t.like(res.data, fooProduct);
});

test("get product, not found", async (t) => {
  const res = await rolo().get("/products/123");
  t.is(res.status, 404);
});

test("update product", async (t) => {
  const res = await rolo().patch(`/products/${fooProductId}`, {
    name: "foo2",
  });
  fooProduct.name = "foo2";
  t.is(res.status, 204);
  t.is(res.data, "");
});

test("update product, not found", async (t) => {
  const res = await rolo().patch("/products/123", { name: "123" });
  t.is(res.status, 404);
});

test("update product, bad edition", async (t) => {
  const res = await rolo().patch(`/products/${fooProductId}`, {
    edition: "foo",
  });
  t.is(res.status, 400);
});

test("update product, violating unique constraint", async (t) => {
  // try to update bar to foo's bundleId
  const res2 = await rolo().patch(`/products/${barProductId}`, {
    bundleId: fooProduct.bundleId,
  });
  t.is(res2.status, 409);
});

test("update product, duplicate of self", async (t) => {
  const res = await rolo().patch(`/products/${fooProductId}`, {
    bundleId: fooProduct.bundleId,
  });
  t.is(res.status, 204);
  t.is(res.data, "");
});

test("update product, no update access", async (t) => {
  const res = await rolo("readonly").patch(`/products/${fooProductId}`, {
    name: "foo4",
  });
  t.is(res.status, 403);
});

test("list products", async (t) => {
  const res = await rolo().get("/products?limit=2");
  t.is(res.status, 200);
  t.is(res.data.items.length, 2);
  t.is(res.data.object, "list");
  t.like(res.data.items[1], fooProduct);
  t.like(res.data.items[0], barProduct);
});

test("add an object to the foo prduct that is not in the schema", async (t) => {
  const res = await rolo().patch(`/products/${fooProductId}`, {
    foo: "bar",
  });
  t.is(res.status, 400);
  // check that it was not added
  const res2 = await rolo().get(`/products/${fooProductId}`);
  t.is(res2.status, 200);
  t.is(res2.data.foo, undefined);
});

test("verify that foo does not have an aquaticprime key pair", async (t) => {
  const res = await rolo().get(`/products/${fooProductId}`);
  t.is(res.status, 200);
  t.is(res.data.aquaticPrimeKeyPair, undefined);
});

test("add an aquaticprime key pair to the foo product", async (t) => {
  const res = await rolo().patch(`/products/${fooProductId}`, {
    aquaticPrimeKeyPair: testAquaticPrimeKeyPair,
  });
  t.is(res.status, 204);
});

test("retreive the aquaticprime key pair from the foo product", async (t) => {
  const res = await rolo().get(`/products/${fooProductId}`);
  t.is(res.status, 200);
  t.like(res.data, { aquaticPrimeKeyPair: testAquaticPrimeKeyPair });
});

test("delete product", async (t) => {
  const res2 = await rolo().delete(`/products/${barProductId}`);
  t.is(res2.status, 204);
  t.is(res2.data, "");
});

test("delete product, not found", async (t) => {
  const res = await rolo().delete("/products/123");
  t.is(res.status, 404);
});
