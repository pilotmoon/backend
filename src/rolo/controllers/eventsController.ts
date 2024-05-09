// an event is a record of something that happened in the system

import { z } from "zod";
import { Auth, AuthKind, authKinds } from "../auth.js";
import { getDb } from "../database.js";
import { handleControllerError } from "../../common/errors.js";
import { Pagination, paginate } from "../paginate.js";
import { EventInfo, ZEventInfo } from "../../twix/directory/eventRecord.js";
import { days } from "../../common/timeIntervals.js";

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
  return getDb(kind).collection<EventRecord>(eventsCollectionName, {
    ignoreUndefined: true,
  });
}

// called at server startup to create indexes
export async function init() {
  for (const kind of authKinds) {
    const collection = dbc(kind);
    collection.createIndex({ created: 1 });
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
      scopes: [`events:create`],
      kind: authKind,
    }),
  );
}

export async function listEvents(pagination: Pagination, auth: Auth) {
  auth.assertAccess(eventsCollectionName, undefined, "read");
  try {
    const documents = await paginate(dbc(auth.kind), pagination);
    return documents;
  } catch (e) {
    handleControllerError(e);
    throw e;
  }
}
