import { log } from "../common/log.js";

// wait for rolo
export async function waitFor(desc: string, readyFn: () => Promise<boolean>) {
  let retries = 0;
  let done = false;
  do {
    try {
      done = await readyFn();
    } catch (e) {
      log(`Waiting for ${desc} (${++retries})`.yellow);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } while (!done && retries < 60);
  if (done) {
    log(`${desc} is ready`.black.bgGreen);
  } else {
    throw new Error(`${desc} timed out`);
  }
}
