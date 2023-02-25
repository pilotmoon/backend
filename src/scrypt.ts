import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { log, loge } from "./logger";
const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return Buffer.concat([salt, buf]);
}

export async function verifyPassword(
  saltedHash: Buffer,
  suppliedPassword: string,
) {
  let result = false;
  try {
    const salt = saltedHash.subarray(0, 16);
    const hash = saltedHash.subarray(16);
    result = timingSafeEqual(
      hash,
      await scryptAsync(suppliedPassword, salt, 64) as Buffer,
    );
  } catch (e) {
    // do nothing
  }
  return result;
}
