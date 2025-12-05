import { randomString } from "@pilotmoon/chewit";
import test from "ava";
import { rolo } from "./setup.js";

const sampleName = `assets/${randomString({ length: 8 })}.txt`;
const simpleName = `${randomString({ length: 6 })}.txt`;
const sampleData = Buffer.from(
  `Files test payload ${Date.now()}_${randomString({ length: 6 })}`,
);
const fileIdPattern = /^file_[0-9a-f]{24}$/;
let fileId = "";
let simpleFileId = "";

test("upload file stream", async (t) => {
  const res = await rolo().post("files", sampleData, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Length": sampleData.length,
    },
    params: { name: sampleName },
    maxBodyLength: Number.POSITIVE_INFINITY,
  });
  t.is(res.status, 201);
  fileId = res.data.id;
  t.regex(fileId, fileIdPattern);
});

test("upload simple file stream", async (t) => {
  const res = await rolo().post("files", sampleData, {
    headers: {
      "Content-Type": "text/plain",
    },
    params: { name: simpleName },
    maxBodyLength: Number.POSITIVE_INFINITY,
  });
  t.is(res.status, 201);
  simpleFileId = res.data.id;
});

test("get file metadata by id", async (t) => {
  const res = await rolo().get(`files/${fileId}`);
  t.is(res.status, 200);
  t.is(res.data.id, fileId);
  t.is(res.data.name, sampleName);
  t.false(res.data.hidden);
});

test("nonexistent file id returns 404", async (t) => {
  const res = await rolo().get("files/file_ffffffffffffffffffffffff");
  t.is(res.status, 404);
});

test("invalid file id format returns 404", async (t) => {
  const res = await rolo().get("files/not-a-file-id");
  t.is(res.status, 404);
});

test("list files includes uploaded file", async (t) => {
  const res = await rolo().get("files", {
    params: { limit: 10 },
  });
  t.is(res.status, 200);
  t.is(res.data.object, "list");
  const ids = res.data.items.map((item: any) => item.id);
  t.true(ids.includes(fileId));
});

test("list files sorts by created ascending", async (t) => {
  const res = await rolo().get("files", {
    params: { sort: 1, sortBy: "created", limit: 20 },
  });
  t.is(res.status, 200);
  const created = res.data.items.map((item: any) =>
    Date.parse(item.created ?? ""),
  );
  const sorted = [...created].sort((a, b) => a - b);
  t.deepEqual(created, sorted);
});

test("download file by name", async (t) => {
  const res = await rolo().get(`files/${sampleName}`, {
    responseType: "arraybuffer",
  });
  t.is(res.status, 200);
});

test("download simple file by name", async (t) => {
  const res = await rolo().get(`files/${simpleName}`, {
    responseType: "arraybuffer",
  });
  t.is(res.status, 200);
  t.deepEqual(Buffer.from(res.data), sampleData);
});

test("hide file prevents name access", async (t) => {
  const res = await rolo().patch(`files/${fileId}`, {
    hidden: true,
  });
  t.is(res.status, 200);
  t.true(res.data.hidden);

  const byName = await rolo().get(`files/${sampleName}`, {
    responseType: "arraybuffer",
  });
  t.is(byName.status, 404);

  const meta = await rolo().get(`files/${fileId}`);
  t.is(meta.status, 200);
  t.true(meta.data.hidden);

  const list = await rolo().get("files", {
    params: { limit: 10 },
  });
  t.is(list.status, 200);
  const hiddenEntry = list.data.items.find((item: any) => item.id === fileId);
  t.truthy(hiddenEntry);
  t.true(hiddenEntry.hidden);
});

test("duplicate names are rejected", async (t) => {
  const res = await rolo().post("files", sampleData, {
    headers: {
      "Content-Type": "text/plain",
    },
    params: { name: sampleName },
    maxBodyLength: Number.POSITIVE_INFINITY,
  });
  t.is(res.status, 409);
});

test("id-like names are rejected", async (t) => {
  const idLikeName = `file_${"abcdef0123456789".repeat(1).padEnd(24, "0")}`;
  const res = await rolo().post("files", sampleData, {
    headers: {
      "Content-Type": "text/plain",
    },
    params: { name: idLikeName },
    maxBodyLength: Number.POSITIVE_INFINITY,
  });
  t.is(res.status, 400);
});

test("missing file name is rejected", async (t) => {
  const res = await rolo()
    .post("files", sampleData, {
      headers: {
        "Content-Type": "text/plain",
      },
      maxBodyLength: Number.POSITIVE_INFINITY,
    })
    .catch((error) => error.response);
  if (!res) {
    t.fail("File upload endpoint unavailable");
    return;
  }
  t.is(res.status, 400);
  t.true(String(res.data).includes("File name is required"));
});
