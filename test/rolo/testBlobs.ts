import test from "ava";
import { rolo } from "./setup.js";
import { randomString } from "@pilotmoon/chewit";

const emptyFileHash = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
const emptyFileHash2 =
  "473a0f4c3be8a93681a267e3b1e9a7dcda1185436fe141f7749120a303721813";
let helloWorldId = "";
let helloWorldHash = "";
let helloWorldString = `hello world ${randomString({ length: 10 })}`;
let helloWorldBase64 = Buffer.from(helloWorldString).toString("base64");
test("create new blob", async (t) => {
  const res = await rolo().post("blobs", {
    data: helloWorldBase64,
  });
  helloWorldId = res.data.id;
  helloWorldHash = res.data.h1;
  t.is(res.status, 201);
  t.is(res.data.data, undefined);
  t.is(res.headers.location, `/blobs/${helloWorldId}`);
});

test("get blob with data", async (t) => {
  const res = await rolo().get(`blobs/${helloWorldId}`, {
    params: { includeData: 1 },
  });
  t.is(res.status, 200);
  t.is(res.data.data, helloWorldBase64);
  t.is(res.data.id, helloWorldId);
  t.log(res.data);
});

test("get blob without data", async (t) => {
  const res = await rolo().get(`blobs/${helloWorldId}`);
  t.is(res.status, 200);
  t.is(res.data.data, undefined);
  t.is(res.data.id, helloWorldId);
  t.log(res.data);
});

test("create same blob again, id should be the same", async (t) => {
  const res = await rolo().post("blobs", {
    data: helloWorldBase64,
  });
  t.is(res.status, 201);
  t.is(res.data.id, helloWorldId);
});

test("create blob with empty data; hashes should be the standard git hash for empty files", async (t) => {
  const res = await rolo().post("blobs", {
    data: "",
  });
  // delete the blob in case it already existed
  const resd = await rolo().delete(`blobs/${res.data.id}`);
  t.is(resd.status, 204);
  // check that it's gone
  const resg = await rolo().get(`blobs/${res.data.id}`);
  t.is(resg.status, 404);
  // create it again
  const res2 = await rolo().post("blobs", {
    data: "",
  });
  t.is(res2.status, 201);
  t.is(res2.data.h1, emptyFileHash);
  t.is(res2.data.h2, emptyFileHash2);
});

test("read all blobs", async (t) => {
  const res = await rolo().get("blobs");
  t.is(res.status, 200);
  t.is(res.data.object, "list");
  t.true(res.data.count > 0);
  t.log(res.data);
});

test("read blob by hash", async (t) => {
  const res = await rolo().get(`blobs/${helloWorldHash}`);
  t.is(res.status, 200);
  t.is(res.data.object, "blob");
  t.is(res.data.id, helloWorldId);
  t.log(res.data);
});

test("read blob by hash, including data", async (t) => {
  const res = await rolo().get(`blobs/${helloWorldHash}`, {
    params: { includeData: 1 },
  });
  t.is(res.status, 200);
  t.is(res.data.object, "blob");
  t.is(res.data.id, helloWorldId);
  t.is(res.data.data, helloWorldBase64);
  t.log(res.data);
});

test("read multiple blobs by hash", async (t) => {
  const res = await rolo().get("blobs", {
    params: {
      hash: [helloWorldHash, emptyFileHash2].join(","),
      limit: 100,
    },
  });
  t.is(res.status, 200);
  t.is(res.data.object, "list");
  t.is(res.data.count, 2);
  t.true(new Set(res.data.items.map((item: any) => item.id)).has(helloWorldId));
  t.log(res.data);
});
