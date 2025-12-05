// an event is a record of something that happened in the system

import { z } from "zod";
import { handleControllerError } from "../../common/errors.js";
import { type EventInfo, ZEventInfo } from "../../common/events.js";
import { log } from "../../common/log.js";
import { arrayFromQuery } from "../../common/query.js";
import { days } from "../../common/timeIntervals.js";
import { Auth, type AuthKind, authKinds } from "../auth.js";
import { getDb } from "../database.js";
import { type Pagination, paginate } from "../paginate.js";

// as stored in the database
export const ZEventRecord = z.object({
  object: z.literal("event"),
  created: z.date(),
  info: ZEventInfo,
});
export type EventRecord = z.infer<typeof ZEventRecord>;

const eventsCollectionName = "events";
// helper function to get the database collection for a given key kind
function dbc(kind: AuthKind) {
  return getDb(kind).collection<EventRecord>(eventsCollectionName);
}

// called at server startup to create indexes
export async function init() {
  for (const kind of authKinds) {
    const collection = dbc(kind);
    collection.createIndex({ created: 1 });
    collection.createIndex({ "info.type": 1 });
  }
}

async function deleteEventsOlderThan(date: Date, authKind: AuthKind) {
  await dbc(authKind).deleteMany({ created: { $lt: date } });
}

export async function housekeep() {
  for (const kind of authKinds) {
    await deleteEventsOlderThan(new Date(Date.now() - days(90)), kind);
  }
}

// CRUD
export async function createEvent(info: EventInfo, auth: Auth) {
  auth.assertAccess(eventsCollectionName, undefined, "create");
  const now = new Date();
  const document: EventRecord = {
    object: "event",
    created: now,
    info,
  };
  try {
    await dbc(auth.kind).insertOne(document);
    return document;
  } catch (e) {
    handleControllerError(e);
    throw e;
  }
}

export async function createEventInternal(info: EventInfo, authKind: AuthKind) {
  return await createEvent(
    info,
    new Auth({
      scopes: ["events:create"],
      kind: authKind,
    }),
  );
}

export async function listEvents(
  query: unknown,
  pagination: Pagination,
  auth: Auth,
) {
  auth.assertAccess(eventsCollectionName, undefined, "read");
  try {
    const pipeline = [];
    log({ query });
    const types = arrayFromQuery(query, "info.type", []);
    log({ types });
    if (types.length > 0) {
      pipeline.push({ $match: { "info.type": { $in: types } } });
    }
    const documents = await paginate(dbc(auth.kind), pagination, pipeline);
    return documents;
  } catch (e) {
    handleControllerError(e);
    throw e;
  }
}
