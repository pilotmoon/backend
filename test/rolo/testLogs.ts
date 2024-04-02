import test from "ava";
import { rolo } from "./setup.js";

test("create new log with message", async (t) => {
  const response = await rolo().post("/logs", {
    message: "Hello, World!",
  });
  t.is(response.status, 201);
});

test("new log, omit message", async (t) => {
  const response = await rolo().post("/logs");
  t.is(response.status, 400);
});

test("new log, empty message", async (t) => {
  const response = await rolo().post("/logs", {
    message: "",
  });
  t.is(response.status, 201);
});

test("new log, extra params", async (t) => {
  const response = await rolo().post("/logs", {
    message: "Hello, World!",
    extra: "param",
  });
  t.is(response.status, 400);
});

test("new log, no auth", async (t) => {
  const response = await rolo().post(
    "/logs",
    {
      message: "Hello, World!",
    },
    {
      headers: {
        Authorization: null,
      },
    },
  );
  t.is(response.status, 401);
});

test("new log, no scope", async (t) => {
  const response = await rolo("noscope").post("/logs", {
    message: "Hello, World!",
  });
  t.is(response.status, 403);
});

test("retreive logs, check content of last two", async (t) => {
  const response = await rolo().get("/logs");
  t.is(response.status, 200);
  t.is(response.data.items[0].entries[0].message, "");
  t.is(response.data.items[1].entries[0].message, "Hello, World!");
});

test("retreive logs with search param", async (t) => {
  const response = await rolo().get("/logs?text=Hello");
  t.is(response.status, 200);
  t.is(response.data.items[0].entries[0].message, "Hello, World!");
});

test("new log, retreive using id", async (t) => {
  const response = await rolo().post("/logs", {
    message: "Hello, World!",
  });
  t.is(response.status, 201);
  const id = response.data.id;
  const getResponse = await rolo().get(`/logs/${id}`);
  t.is(getResponse.status, 200);
  t.is(getResponse.data.entries[0].message, "Hello, World!");
});

let testLogId: string;
let testLogUrl: string;
test("new log, retreive using token link", async (t) => {
  const response = await rolo().post("/logs", {
    message: "Hello, Universe!",
  });
  t.is(response.status, 201);
  const url = response.data.url;
  t.log(url);
  const getResponse = await rolo().get(url, {
    headers: {
      Authorization: null,
    },
  });
  testLogId = getResponse.data.id;
  testLogUrl = url;
  t.is(getResponse.status, 200);
  t.log(getResponse.data);
  t.is(getResponse.data.entries[0].message, "Hello, Universe!");
});

test("append to log", async (t) => {
  const response = await rolo().patch(`/logs/${testLogId}`, {
    message: "Hello, Galaxy!",
  });
  t.is(response.status, 204);
});

test("append to log, omit message", async (t) => {
  const response = await rolo().patch(`/logs/${testLogId}`);
  t.is(response.status, 400);
});

test("append to log, no scope", async (t) => {
  const response = await rolo("noscope").patch(`/logs/${testLogId}`, {
    message: "Hello, Galaxy!",
  });
  t.is(response.status, 403);
});

test("try append to log with token", async (t) => {
  const response = await rolo().patch(
    testLogUrl,
    {
      message: "Hello, Galaxy!",
    },
    {
      headers: {
        Authorization: null,
      },
    },
  );
  t.is(response.status, 403);
});

test("read log in text format", async (t) => {
  const response = await rolo().get(`/logs/${testLogId}?format=text`);
  t.is(response.status, 200);
  t.is(response.headers["content-type"].split(";")[0], "text/plain");
});
