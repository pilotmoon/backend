import test from "ava";
import { rolo } from "./setup.js";
import { randomInt } from "node:crypto";

let plodId: string;
let plodGithubId: number;
let adamJoeId: string;

test("create author, inserting same githubId twice", async (t) => {
  const res1 = await rolo().post("authors", {
    type: "github",
    githubId: 1000,
    githubHandle: "joe",
    githubType: "User",
    githubUrl: "https://example.com/joe",
  });
  t.is(res1.status, 201);
  t.log(res1.data);
  const res2 = await rolo().post("authors", {
    type: "github",
    githubId: 1000,
    githubHandle: "adam",
    githubType: "User",
    githubUrl: "https://example.com/adam",
  });
  t.log(res2.data);
  t.is(res2.status, 201);
  t.is(res1.data.id, res2.data.id);
  t.is(res2.data.info.githubHandle, "adam");
  adamJoeId = res2.data.id;
});

test("create new author", async (t) => {
  plodGithubId = randomInt(1001, 100000000);
  const res = await rolo().post("authors", {
    type: "github",
    githubId: plodGithubId,
    githubHandle: "pcplod",
    githubType: "User",
    githubUrl: "https://example.com/pcplod",
  });
  plodId = res.data.id;
  t.is(res.status, 201);
  t.log(res.data);
});

test("get author by id", async (t) => {
  const res = await rolo().get(`authors/${plodId}`);
  t.is(res.status, 200);
  t.log(res.data);
  t.is(res.data.id, plodId);
});

test("patch autoPublish var to true", async (t) => {
  const res = await rolo().patch(`authors/${plodId}`, {
    autoPublish: true,
  });
  t.is(res.status, 204);
  t.log(res.data);
});

test("get author by id again and check autoPublish", async (t) => {
  const res = await rolo().get(`authors/${plodId}`);
  t.is(res.status, 200);
  t.log(res.data);
  t.is(res.data.autoPublish, true);
});

test("update info for author", async (t) => {
  const res = await rolo().post(`authors`, {
    type: "github",
    githubId: plodGithubId,
    githubHandle: "pcplod2",
    githubType: "User",
    githubUrl: "https://example.com/pcplod",
    bio: "I am a test author",
  });
  t.is(res.status, 201);
  t.is(res.data.autoPublish, true);
  t.log(res.data);
});

test("list authors", async (t) => {
  const res = await rolo().get("authors");
  t.is(res.status, 200);
  t.log(res.data);
  t.is(res.data.items[0].info.githubHandle, "pcplod2");
  t.is(res.data.items[0].info.bio, "I am a test author");
  t.is(res.data.items[0].autoPublish, true);
  t.is(res.data.items[1].info.githubHandle, "adam");
  t.is(res.data.items[1].info.githubId, 1000);
});

test("delete author (adam)", async (t) => {
  const res = await rolo().delete(`authors/${adamJoeId}`);
  t.is(res.status, 204);
  const res2 = await rolo().get(`authors/${adamJoeId}`);
  t.is(res2.status, 404);
});
