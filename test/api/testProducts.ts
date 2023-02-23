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
  t.is(res.status, 200);
  t.like(res.data, { ...fooProduct, name: "foo2" });
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

test("update product, duplicate of another", async (t) => {
  // first create new product
  const res = await rolo().post("products", barProduct);
  t.is(res.status, 201);
  barProductId = res.data.id;

  // then try to update bar to foo's bundleId
  const res2 = await rolo().patch(`/products/${barProductId}`, {
    bundleId: fooProduct.bundleId,
  });
  t.is(res2.status, 409);
});

test("update product, duplicate of self", async (t) => {
  const res = await rolo().patch(`/products/${fooProductId}`, {
    bundleId: fooProduct.bundleId,
  });
  t.is(res.status, 200);
});

test("update product, no read access", async (t) => {
  const res = await rolo("updateonly").patch(`/products/${fooProductId}`, {
    name: "foo3",
  });
  t.is(res.status, 204);
  t.is(res.data, "");
  // set it back
  const res2 = await rolo().patch(`/products/${fooProductId}`, {
    name: "foo",
  });
  t.is(res2.status, 200);
  t.like(res2.data, fooProduct);
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
  t.is(res.data.length, 2);
  t.like(res.data[1], fooProduct);
  t.like(res.data[0], barProduct);
});

test("delete products", async (t) => {
  const res = await rolo().delete(`/products/${fooProductId}`);
  t.is(res.status, 204);
  t.is(res.data, "");
  const res2 = await rolo().delete(`/products/${barProductId}`);
  t.is(res2.status, 204);
  t.is(res2.data, "");
});

test("delete product, not found", async (t) => {
  const res = await rolo().delete("/products/123");
  t.is(res.status, 404);
});
