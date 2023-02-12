import Prando from "prando";
import { defaultRng, randomString } from "@pilotmoon/chewit";
import { config } from "./config";
import { logw } from "./logger";

// pseudo-random number generator
const prando = new Prando(config.BOOTSTRAP_SEED);
let prngCount = 0;
function pseudoRng(size: number): Array<number> {
  logw("Using pseudo-random number generator", { count: ++prngCount });
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(prando.nextInt(0, 255));
  }
  return arr;
}

// return the currently configured RNG
let usePrng = false;
function rng() {
  return usePrng ? pseudoRng : defaultRng;
}

// generate a random identifier with the given prefix
export function randomIdentifier(prefix: string): string {
  return `${prefix}_${randomString({ length: 24, rng: rng() })}`;
}

// run a block of code with the deterministic RNG
export async function deterministic(block: () => void) {
  usePrng = true;
  await block();
  usePrng = false;
}
