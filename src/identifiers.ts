import Prando from "prando";
import { defaultRng, randomString } from "@pilotmoon/chewit";
import { config } from "./config";
import { logw } from "./logger";

export type KeyKind = typeof keyKinds[number];
export type IdPrefix = typeof idPrefixes[number];
export type Key = `key_${KeyKind}_${string}`;
export type Id = `${IdPrefix}_${string}`;

export const keyKinds = ["test", "live"] as const;
export const idPrefixes = ["ak"] as const;
const keyLength = 24;
const idLength = 16;
const keyPrefix = "key";
const base62 = (n: number) => `[0-9a-zA-Z]{${n}}`;
export const keyRegex = new RegExp(
  `^${keyPrefix}_(${keyKinds.join("|")})_${base62(idLength)}${
    base62(keyLength)
  }`,
);

// generate a random identifier with the given prefix
export function randomIdentifier(prefix: IdPrefix): Id {
  return `${prefix}_${randomString({ length: idLength, rng: rng() })}`;
}

// generate a key with the given kind, and its identifier
export function randomKey(
  kind: KeyKind,
  identifierPrefix: IdPrefix,
): { key: Key; id: Id } {
  const idChars = randomString({ length: idLength, rng: rng() });
  const keyChars = randomString({ length: keyLength, rng: rng() });
  const id = `${identifierPrefix}_${idChars}` as const;
  const key = `${keyPrefix}_${kind}_${idChars}${keyChars}` as const;
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
