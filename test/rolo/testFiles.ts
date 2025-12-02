import { randomString } from "@pilotmoon/chewit";
import test from "ava";
import { rolo } from "./setup.js";

const sampleName = `assets/${randomString({ length: 8 })}.txt`;
const simpleName = `${randomString({ length: 6 })}.txt`;
const sampleData = Buffer.from(
  `Files test payload ${Date.now()}_${randomString({ length: 6 })}`,
);
let fileId = "";
let simpleFileId = "";

test("upload file stream", async (t) => {
  const res = await rolo().post("files", sampleData, {
    headers: {
      "Content-Type": "text/plain",
      "X-File-Name": sampleName,
      "Content-Length": sampleData.length,
    },
    maxBodyLength: Number.POSITIVE_INFINITY,
  });
  t.is(res.status, 201);
  fileId = res.data.id;
});

test("upload simple file stream", async (t) => {
  const res = await rolo().post("files", sampleData, {
    headers: {
      "Content-Type": "text/plain",
      "X-File-Name": simpleName,
    },
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

test("list files includes uploaded file", async (t) => {
  const res = await rolo().get("files", {
    params: { limit: 10 },
  });
  t.is(res.status, 200);
  t.is(res.data.object, "list");
  const ids = res.data.items.map((item: any) => item.id);
  t.true(ids.includes(fileId));
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
});

test("duplicate names are rejected", async (t) => {
  const res = await rolo().post("files", sampleData, {
    headers: {
      "Content-Type": "text/plain",
      "X-File-Name": sampleName,
    },
    maxBodyLength: Number.POSITIVE_INFINITY,
  });
  t.is(res.status, 409);
});
