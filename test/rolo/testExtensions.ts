import test from "ava";
import { rolo } from "./setup.js";
import { ExtensionOrigin } from "../../src/common/extensionSchemas.js";
import { AuthorInfo } from "../../src/rolo/controllers/authorsController.js";
import { randomString } from "@pilotmoon/chewit";

const origin: ExtensionOrigin = {
  type: "githubGist",
  gistId: "1234",
  gistOwnerId: 5678,
  gistOwnerHandle: "bilbo",
  gistOwnerType: "User",
  gistUrl: "https://gist.github.com/bilbo/1234",
  commitSha: "aaaabbbbaaaabbbbaaaabbbbaaaabbbbaaaabbbb",
  commitDate: new Date(),
};

const author: AuthorInfo = {
  type: "github",
  githubId: 1234,
  githubHandle: "bilbo",
  githubType: "User",
  githubUrl: "https://github.com/bilbo",
  websiteUrl: "https://example.com/bilbo",
  name: "Bilbo Baggins",
};

const validYaml = `name: Hello World
identifier: com.example.id-1-${randomString({ length: 10 })}
description: A simple hello world extension ${randomString({ length: 10 })}
actions:
- {}`;
const validYamlBuffer = Buffer.from(validYaml);
let validYamlBlobHash: string;

const validSnippet = `#popclip
name: Hello World 2
identifier: com.example.id-2-${randomString({ length: 10 })}
description: foo bar ${randomString({ length: 10 })}
actions:
- {}`;
const validSnippetBuffer = Buffer.from(validSnippet);
let validSnippetBlobHash: string;

const invalidConfig = randomString();
const invalidConfigBuffer = Buffer.from(invalidConfig);
let invalidConfigBlobHash: string;

test("create extension with no files", async (t) => {
  const extension = await rolo().post("/extensions", {
    origin,
    author,
    version: "1.0",
    files: [],
  });
  t.is(extension.status, 400);
  t.log(extension.data);
});

test("create extension with invalid file, random name", async (t) => {
  const res = await rolo().post("/blobs", {
    data: invalidConfigBuffer.toString("base64"),
  });
  t.is(res.status, 201);
  invalidConfigBlobHash = res.data.h2;
  const file = {
    path: "fsdfdf",
    hash: invalidConfigBlobHash,
    size: invalidConfigBuffer.length,
  };
  const extension = await rolo().post("/extensions", {
    origin,
    author,
    version: "1.0",
    files: [file],
  });
  t.is(extension.status, 400);
  t.log(extension.data);
});

test("create extension with invalid file, config name", async (t) => {
  const file = {
    path: "Config.plist",
    hash: invalidConfigBlobHash,
    size: invalidConfigBuffer.length,
  };
  const extension = await rolo().post("/extensions", {
    origin,
    author,
    version: "1.0",
    files: [file],
  });
  t.is(extension.status, 400);
  t.log(extension.data);
});

test("create extension with valid Config.yaml", async (t) => {
  const res = await rolo().post("/blobs", {
    data: validYamlBuffer.toString("base64"),
  });
  t.is(res.status, 201);
  validYamlBlobHash = res.data.h2;
  const file = {
    path: "Config.yaml",
    hash: validYamlBlobHash,
    size: validYamlBuffer.length,
  };
  const extension = await rolo().post("/extensions", {
    origin,
    author,
    version: "1.0",
    files: [file],
  });
  t.is(extension.status, 201);
  t.log(extension.data);
});

test("create extension with valid snippet", async (t) => {
  const res = await rolo().post("/blobs", {
    data: validSnippetBuffer.toString("base64"),
  });
  t.is(res.status, 201);
  validSnippetBlobHash = res.data.h2;
  const file = {
    path: "snippet.blah",
    hash: validSnippetBlobHash,
    size: validSnippetBuffer.length,
  };
  const extension = await rolo().post("/extensions", {
    origin,
    author,
    version: "1.0",
    files: [file],
  });
  t.is(extension.status, 201);
  t.log(extension.data);
});

test("submit exact same extension files with different version", async (t) => {
  const file = {
    path: "Config.yaml",
    hash: validYamlBlobHash,
    size: validYamlBuffer.length,
  };
  const extension = await rolo().post("/extensions", {
    origin,
    author,
    version: "1.1",
    files: [file],
  });
  t.is(extension.status, 409);
  t.log(extension.data);
});

async function validUniqueFiles() {
  const dummyFileBuffer = Buffer.from(randomString());
  const res = await rolo().post("/blobs", {
    data: dummyFileBuffer.toString("base64"),
  });
  const dummyBlobHash = res.data.h2;
  return [
    {
      path: "Config.yaml",
      hash: validYamlBlobHash,
      size: validYamlBuffer.length,
    },
    {
      path: "dummy",
      hash: dummyBlobHash,
      size: dummyFileBuffer.length,
    },
  ];
}

test("submit modified extension files with same version", async (t) => {
  const extension = await rolo().post("/extensions", {
    origin,
    author,
    version: "1.0",
    files: await validUniqueFiles(),
  });
  t.is(extension.status, 400);
  t.log(extension.data);
});

test("submit modified extension files with higher version", async (t) => {
  const extension = await rolo().post("/extensions", {
    origin,
    author,
    version: "1.1",
    files: await validUniqueFiles(),
  });
  t.is(extension.status, 201);
});

test("submit altered origin", async (t) => {
  const extension = await rolo().post("/extensions", {
    origin: { ...origin, gistId: "7890" },
    author,
    version: "1.2",
    files: await validUniqueFiles(),
  });
  t.is(extension.status, 400);
  t.log(extension.data);
});
