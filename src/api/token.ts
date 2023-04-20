// This module will generate and validate access tokens for the API.
// The access token is a custom format, not a JWT. The format is:
//  <token type><database kind><base62-encoded data>
// The token type is a single character, as follows:
//  '1' - API key - the access token is an API key
//  '2' - encrypted scopes - the access token is a signed list of scopes
//  '3' - encrypted scopes with associated resource - the access token is a signed list of scopes, with an associated resource
// The database kind is a single character, as follows:
//  '5' - live
//  '7' - test
// The format of the base62-encoded data depends on the token type:
//  API key - the data is the secret key with the sk_[test|live]_ prefix removed
//  encrypted scopes - the data is an encrypted CBOR object with the following properties:
//    s - the list of scopes as an array of strings
//    e - the expiration date as a unix timestamp in milliseconds (optional)
//  encrypted scopes with associated resource - the data is as above, but the encrypted data
//    has additional authenticated data, which is the first two components the path, separated by a
//    slash. This is used to ensure that the token is only valid for the resource indicated by the URL.
//    A further purpose is that the generated token is significantly shorter with this format.
//    In the list of scopes, the character $ is used in place of the resource indicated
//    by the URL path.
//    e.g. `$:read` with a path of `users/u_1234` would indicate the scope: `users/u_1234:read`
// The token is encrypted using the secret key for the database kind using aes-256-gcm. This is
// an authenticated symmetric encryption algorithm, so the same key is used for encryption and decryption.
// The encrypted data is base62-encoded, and the result
// is appended to the token type and database kind to form the access token.
// The access token is validated by decrypting the data. Verification of the scopes and expiration
// is left to the caller.

import { decrypt, encrypt } from "./secrets.js";
import { AuthKind } from "./auth.js";
import { alphabets, baseDecode, baseEncode } from "@pilotmoon/chewit";
import { z } from "zod";
import { decodeFirstSync, encode } from "cbor";

const encoder = new TextEncoder();
const textEncode = encoder.encode.bind(encoder);

function characterForKeyKind(databaseKind: string): string {
  switch (databaseKind) {
    case "live":
      return "5";
    case "test":
      return "7";
    default:
      throw new Error(`Invalid database kind: ${databaseKind}`);
  }
}

function keyKindForCharacter(character: string): AuthKind {
  switch (character) {
    case "5":
      return "live";
    case "7":
      return "test";
    default:
      throw new Error(`Invalid database kind character: ${character}`);
  }
}

const ZTokenData = z.object({
  e: z.number().optional(),
  s: z.array(z.string()),
});
type TokenData = z.infer<typeof ZTokenData>;

// Generate and encrypt an access token for the given parameters.
// If resource is specified, the token will be encrypted with additional authenticated data,
// which is the resource. This is used to ensure that the token is only valid for the resource
// indicated by the URL.
// In that case the list of scopes should contain the character $ in place of the resource
// indicated by the URL path.
export function generateEncryptedToken(
  { keyKind, scopes, expires: expiration, resource }: {
    keyKind: AuthKind;
    scopes: string[];
    expires?: Date;
    resource?: string;
  },
): string {
  const tokenType = resource ? "3" : "2";
  // if resource is specified
  if (resource) {
    // replace resource in the list of scopes with $
    scopes = scopes.map((scope) => scope.replace(resource, "$"));
  }

  // create the token data
  const tokenData: TokenData = { s: scopes };
  if (expiration) {
    tokenData.e = expiration.getTime();
  }

  const encryptedData = encrypt(
    encode(tokenData),
    keyKind,
    textEncode(resource),
  );
  // convert the buffer to an array of numbers
  const encryptedDataArray = Array.from(encryptedData);

  // base62-encode the encrypted data, and prepend the token type and database kind
  return `${tokenType}${characterForKeyKind(keyKind)}${
    baseEncode(encryptedDataArray, alphabets.base62, { trim: false })
  }`;
}

// Generate an access token for the given API key.
export function generateApiKeyToken(secretKey: string): string {
  // verify that the secret key starts with sk_live_ or sk_test_
  if (!secretKey.startsWith("sk_live_") && !secretKey.startsWith("sk_test_")) {
    throw new Error(`Invalid secret key: ${secretKey}`);
  }
  const keyKind = secretKey.startsWith("sk_live_") ? "live" : "test";
  const key = secretKey.replace(/^sk_(live|test)_/, "");
  return `1${characterForKeyKind(keyKind)}${key}`;
}

// Given an access token and resource path, decipher it and return an object with the following properties:
//  keyKind - the database kind, either "live" or "test"
//  secretKey - the secret key (only present if the token type is "1")
//  scopes - the decrypted scopes (only present if the token type is "2" or "3")
//              in the case of "3", the character $ in the list of scopes is replaced with the resource
//  expires - the expiration date (only present if the token type is "2" or "3")
// If the token is invalid, throws an error. Should never print a token to the console or put it in an error message.
export function decipherToken(token: string, resource: string): {
  keyKind: AuthKind;
  secretKey?: string;
  scopes?: string[];
  expires?: Date;
} {
  // verify that the string is at least 3 characters long
  if (token.length < 3) {
    throw new Error("Invalid token (too short)");
  }

  const tokenType = token[0];
  const keyKind = keyKindForCharacter(token[1]);
  const base62Data = token.substring(2);

  // API key
  if (tokenType === "1") {
    // API key
    const secretKey = `sk_${keyKind}_${base62Data}`;
    return { keyKind, secretKey };
  }

  // convert base62 data to buffer
  // It is not possible to determine the number of zeroes to trim after decoding the base62,
  // because the encrypted data may actually start with zeroes.
  // So we will try to decrypt the data with different numbers of zeroes at the start
  // until we find a valid decryption.
  // It would have been better to use a different encoding for the encrypted data, potentially
  // using a length prefix, but that would break existing tokens.
  // (There was a bug affecting about 1 in 256 tokens, which is fixed by this change.)
  const encryptedData = Uint8Array.from(
    baseDecode(base62Data, alphabets.base62, { trim: false }),
  );

  // count number of zeroes at the start of encrypted data
  let zeroes = 0;
  while (encryptedData[zeroes] === 0) {
    zeroes++;
  }

  do {
    try {
      // encrypted scopes
      if (tokenType === "2") {
        const tokenData = ZTokenData.parse(
          decodeFirstSync(decrypt(encryptedData.subarray(zeroes), keyKind)),
        );
        const scopes = tokenData.s;
        const expiration = tokenData.e ? new Date(tokenData.e) : undefined;
        return { keyKind, scopes, expires: expiration };
      }

      // encrypted scopes with resource
      if (tokenType === "3") {
        const tokenData = ZTokenData.parse(
          decodeFirstSync(
            decrypt(
              encryptedData.subarray(zeroes),
              keyKind,
              textEncode(resource),
            ),
          ),
        );
        const scopes = tokenData.s.map((scope) =>
          scope.replaceAll("$", resource)
        );
        const expiration = tokenData.e ? new Date(tokenData.e) : undefined;
        return { keyKind, scopes, expires: expiration };
      }
    } catch (e) {
      if (zeroes === 0) {
        throw e;
      }
    }
  } while (--zeroes > 0);

  throw new Error("Invalid token (unknown token type)");
}
