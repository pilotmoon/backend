import { defaultRng, randomString } from "@pilotmoon/chewit";
import Prando from "prando";
import { logw } from "../common/log.js";
import { AuthKind, authKinds } from "./auth.js";

// the collection names, object types and corresponding key prefixes
export const idPrefixes = ["ak", "reg", "lk"] as const;
export const collectionNames = [
  "apiKeys",
  "registries",
  "licenseKeys",
  "health",
  "reports",
] as const;
export const objectNames = [
  "apiKey",
  "registry",
  "licenseKey",
  "licenseKeyFinancialView",
  "licenseKeyHashView",
] as const;
export const objectNamesWithoutId = [
  "health",
  "report",
  "keyPair",
  "record",
  "productConfig",
  "licenseKeyFile",
] as const;

// base definitions for keys and identifiers
const secretKeyPrefix = "sk";
const secretKeyLength = 24;
const idLength = 12;
const base62 = (n: number) => `[0-9a-zA-Z]{${n}}`;
export const secretKeyRegex = new RegExp(
  `^${secretKeyPrefix}_(${authKinds.join("|")})_(${base62(idLength)})${base62(
    secretKeyLength,
  )}$`,
);
export const idRegex = new RegExp(
  `(${idPrefixes.join("|")})_${base62(idLength)}`,
);
// generate a random identifier with the given prefix
export function randomIdentifier(prefix: string): string {
  return `${prefix}_${randomString({ length: idLength, rng: rng() })}`;
}

// generate a key with the given kind, and its identifier
export function randomKey(kind: AuthKind, idPrefix: string) {
  const keyChars = randomString({
    length: idLength + secretKeyLength,
    rng: rng(),
  });
  const idChars = keyChars.slice(0, idLength);
  const id = `${idPrefix}_${idChars}` as const;
  const key = `${secretKeyPrefix}_${kind}_${keyChars}` as const;
  return { key, id };
}

// produce pattern for matching identifiers
export function makeIdentifierPattern(
  varName: string,
  prefix: string,
  fixedIdentifiers: string[] = [],
): string {
  const patterns = [`${prefix}_${base62(idLength)}`].concat(fixedIdentifiers);
  return `/:${varName}(${patterns.join("|")})`;
}

// produce a pattern for matching generic identifiers
export function makeGenericIdPattern(varName: string): string {
  return `/:${varName}([0-9a-zA-Z-_.]+)`;
}

/*** helpers for deterministic tests ***/

// run a block of code with the deterministic RNG
let prando: Prando;
export async function deterministic(seed: string, block: () => void) {
  if (!prando) {
    prando = new Prando(seed);
  }
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

let prngCount = 0;
function pseudoRng(size: number): Array<number> {
  logw("Using PRNG", { count: ++prngCount });
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(prando.nextInt(0, 255));
  }
  return arr;
}
