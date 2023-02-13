import Prando from "prando";
import { defaultRng, randomString } from "@pilotmoon/chewit";
import { config } from "./config";
import { logw } from "./logger";

export type KeyKind = typeof keyKinds[number];
export type IdentifierPrefix = typeof identifierPrefixes[number];
export type Key = `key_${KeyKind}_${string}`;
export type Identifier = `${IdentifierPrefix}_${string}`;

export const keyKinds = ["test", "live"] as const;
export const identifierPrefixes = ["ak"] as const;
const keyLength = 40;
const identifierLength = 16;
const keyPrefix = "key";
const base62 = "[a-zA-Z0-9]";
export const keyRegex = new RegExp(
  `^${keyPrefix}_(${keyKinds.join("|")})_${base62}{${keyLength}}$`,
);

// generate a random identifier with the given prefix
export function randomIdentifier(prefix: IdentifierPrefix): Identifier {
  return `${prefix}_${randomString({ length: identifierLength, rng: rng() })}`;
}

// generate a key with the given kind
export function randomKey(kind: KeyKind): Key {
  return `${keyPrefix}_${kind}_${
    randomString({ length: keyLength, rng: rng() })
  }`;
}

// produce pattern such as `/:id(ak_[0-9a-zA-Z]{20}|current)`
export function makeIdentifierPattern(
  varName: string,
  prefix: string,
  fixedIdentifiers: string[] = [],
): string {
  const patterns = [`${prefix}_${base62}{${identifierLength}}`]
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
