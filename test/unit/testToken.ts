import test from "ava";
import * as token from "../../src/rolo/token.js";

test("generate and deciper encrypted token", (t) => {
  let count = 0;
  while (count++ <= 1000) {
    const scopes = ["foo:read", "bar:*"];
    const expiration = new Date();
    const tokenString = token.generateEncryptedToken({
      keyKind: "test",
      scopes,
      expires: expiration,
    });
    //t.log(tokenString);

    // decipher the token
    const {
      keyKind,
      scopes: decipheredScopes,
      expires: decipheredExpiration,
    } = token.decipherToken(
      tokenString,
      "anyResourceWillDoForDecipheringThisToken",
    );
    t.is(keyKind, "test");
    t.deepEqual(decipheredScopes, scopes);
    t.deepEqual(decipheredExpiration, expiration);
  }
});

test("generate and decipher api key token", (t) => {
  const sk = "sk_test_1234567890";
  const tokenString = token.generateApiKeyToken(sk);
  t.log(tokenString);

  // decipher the token
  const { keyKind, secretKey } = token.decipherToken(tokenString, sk);
  t.is(keyKind, "test");
  t.deepEqual(secretKey, sk);
});

test("generate and decipher api key token with resource", (t) => {
  let count = 0;
  while (count++ <= 1000) {
    const resource = "foo/bar";
    const scopes = ["foo/bar:read", "foo/bar:write", "bingbong"];
    const expiration = new Date();
    const tokenString = token.generateEncryptedToken({
      keyKind: "test",
      scopes,
      expires: expiration,
      resource,
    });
    //t.log(tokenString);

    // decipher the token
    const {
      keyKind,
      scopes: decipheredScopes,
      expires: decipheredExpiration,
    } = token.decipherToken(tokenString, resource);
    t.is(keyKind, "test");
    t.deepEqual(decipheredScopes, scopes);
    t.deepEqual(decipheredExpiration, expiration);
  }
});
