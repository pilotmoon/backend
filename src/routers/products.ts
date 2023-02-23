import { assertScope } from "../authController";
import { makeRouter } from "../koa";
import { getDb } from "../database";
import { config } from "../config";
import { KeyKind } from "../identifiers";

function getCollection(kind: KeyKind) {
  const db = getDb(kind);
  return db.collection("products");
}

export const router = makeRouter();

// blah blah blah
