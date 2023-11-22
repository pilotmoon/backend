import test from "ava";
import { generateEncryptedToken } from "../../src/api/token.js";
import { rolo } from "./setup.js";

test("health", async (t) => {
  const res = await rolo().get("health");
  t.is(res.status, 200);
  t.like(res.data, { object: "health", livemode: false });
});

test("health, no auth", async (t) => {
  const res = await rolo().get("health", {
    headers: { Authorization: null },
  });
  t.is(res.status, 401);
});

test("health, no access", async (t) => {
  const res = await rolo("noscope").get("health");
  t.is(res.status, 403);
});

test("health, query string", async (t) => {
  const res = await rolo().get("health?foo=bar");
  t.is(res.status, 200);
  t.like(res.data, { object: "health", livemode: false });
});

test("health, trailing slash", async (t) => {
  const res = await rolo().get("health/");
  t.is(res.status, 200);
  t.like(res.data, { object: "health", livemode: false });
});

test("health, query string, trailing slash", async (t) => {
  const res = await rolo().get("health/?foo=bar");
  t.is(res.status, 200);
  t.like(res.data, { object: "health", livemode: false });
});

test("not found", async (t) => {
  const res = await rolo().get("not-found");
  t.is(res.status, 404);
});

test("root", async (t) => {
  const res = await rolo().get("/");
  t.is(res.status, 200);
});

// test access health with token
test("token", async (t) => {
  const res = await rolo().get("health", {
    params: {
      token: generateEncryptedToken({
        keyKind: "test",
        expires: new Date(Date.now() + 1000 * 10),
        scopes: ["health:read"],
      }),
    },
    headers: { Authorization: null },
  });
  t.is(res.status, 200);
});

// same but with "health:*" scope
test("token with partial wildcard scope", async (t) => {
  const res = await rolo().get("health", {
    params: {
      token: generateEncryptedToken({
        keyKind: "test",
        expires: new Date(Date.now() + 1000 * 10),
        scopes: ["health:*"],
      }),
    },
    headers: { Authorization: null },
  });
  t.is(res.status, 200);
});

// same but with "*" scope
test("token with wildcard scope", async (t) => {
  const res = await rolo().get("health", {
    params: {
      token: generateEncryptedToken({
        keyKind: "test",
        expires: new Date(Date.now() + 1000 * 10),
        scopes: ["*"],
      }),
    },
    headers: { Authorization: null },
  });
  t.is(res.status, 200);
});

// test access health with no expiry date in token
test("no expiry token", async (t) => {
  const res = await rolo().get("health", {
    params: {
      token: generateEncryptedToken({
        keyKind: "test",
        scopes: ["*"],
      }),
    },
    headers: { Authorization: null },
  });
  t.is(res.status, 200);
});

test("expired token", async (t) => {
  // access with no auth header
  const res = await rolo().get("health", {
    params: {
      token: generateEncryptedToken({
        keyKind: "test",
        expires: new Date(Date.now() - 1000),
        scopes: ["*"],
      }),
    },
    headers: { Authorization: null },
  });
  t.log(res.data);
  t.is(res.status, 401);
});

// test access health with token and auth header (401)
test("token and auth header", async (t) => {
  const res = await rolo().get("health", {
    params: {
      token: generateEncryptedToken({
        keyKind: "test",
        expires: new Date(Date.now() + 1000),
        scopes: ["*"],
      }),
    },
  });
  t.log(res.data);
  t.is(res.status, 401);
});

// test with two valid tokens (401)
test("two tokens", async (t) => {
  // first generaqte a token
  const token = generateEncryptedToken({
    keyKind: "test",
    expires: new Date(Date.now() + 1000),
    scopes: ["*"],
  });
  // access with two tokens
  const res = await rolo().get(`health?token=${token}&token=${token}`, {
    headers: { Authorization: null },
  });
  t.log(res.data);
  t.is(res.status, 401);
});
