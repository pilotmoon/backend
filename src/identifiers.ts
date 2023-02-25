import Prando from "prando";
import { defaultRng, randomString } from "@pilotmoon/chewit";
import { config } from "./config";
import { logw } from "./logger";
import { z } from "zod";

// Key "kinds" refer to the test and live variations of the api keys.
// all operations initiated by the api key happen against the corresponding
// database, and the api key is only valid for that database.
export const keyKinds = ["test", "live"] as const;
export type KeyKind = typeof keyKinds[number];

// the collection names, object types and corresponding key prefixes
export const collections = ["apiKeys", "products", "licenseKeys"] as const;
export const objectTypes = ["apiKey", "product", "licenseKey"] as const;
export const objectTypesWithoutId = ["health", "keyPair"] as const;
export const idPrefixes = ["ak", "pr", "lk"] as const;

// base definitions for keys and identifiers
const secretKeyPrefix = "sk";
const secretKeyLength = 24;
const idLength = 16;
const base62 = (n: number) => `[0-9a-zA-Z]{${n}}`;
export const secretKeyRegex = new RegExp(
  `^${secretKeyPrefix}_(${keyKinds.join("|")})_(${base62(idLength)})${
    base62(secretKeyLength)
  }$`,
);
export const idRegex = new RegExp(
  `(${idPrefixes.join("|")})_${base62(idLength)}`,
);
export const genericIdRegex = /^[0-9a-zA-Z-_.]+$/;
export const genericIdPattern = `[0-9a-zA-Z-_.]+`; // no ^ or $ for use in routes

// general purpose identifier and string schemas
export const ZIdentifier = z.string().trim().regex(genericIdRegex).max(100);
export const ZSaneString = z.string().trim().min(1).max(100);

// generate a random identifier with the given prefix
export function randomIdentifier(prefix: string): string {
  return `${prefix}_${randomString({ length: idLength, rng: rng() })}`;
}

// generate a key with the given kind, and its identifier
export function randomKey(
  kind: KeyKind,
  idPrefix: string,
) {
  const keyChars = randomString({
    length: idLength + secretKeyLength,
    rng: rng(),
  });
  const idChars = keyChars.slice(0, idLength);
  const id = `${idPrefix}_${idChars}` as const;
  const key = `${secretKeyPrefix}_${kind}_${keyChars}` as const;
  return { key, id };
}

// produce pattern such as `/:id(ak_[0-9a-zA-Z]{20}|current)`
export function makeIdentifierPattern(
  varName: string,
  prefix: string,
  fixedIdentifiers: string[] = [],
): string {
  const patterns = [`${prefix}_${base62(idLength)}`]
    .concat(fixedIdentifiers);
  return `/:${varName}(${patterns.join("|")})`;
}

export function makeGenericIdPattern(
  varName: string,
): string {
  return `/:${varName}(${genericIdPattern})`;
}

/*** helpers for deterministic tests ***/

// run a block of code with the deterministic RNG
export async function deterministic(block: () => void) {
  usePrng = true;
  await block();
  usePrng = false;
}

// return the currently configured RNG
let usePrng = false;
function rng() {
  return usePrng ? pseudoRng : defaultRng;
}

// pseudo-random number generator
const prando = new Prando(config.BOOTSTRAP_SEED);
let prngCount = 0;
function pseudoRng(size: number): Array<number> {
  logw("Using PRNG", { count: ++prngCount });
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(prando.nextInt(0, 255));
  }
  return arr;
}
