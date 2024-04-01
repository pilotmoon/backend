import { z } from "zod";
import { handleControllerError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import { authKinds, type Auth, type AuthKind } from "../auth.js";
import { getDb } from "../database.js";
import { randomIdentifier } from "../identifiers.js";
import { Pagination, paginate } from "../paginate.js";
import { minutes } from "../../common/timeIntervals.js";

const collectionName = "logs";
// helper function to get the database collection for a given key kind
function dbc(kind: AuthKind) {
  return getDb(kind).collection<LogSchema>(collectionName);
}

// called at server startup to create indexes
export async function init() {
  for (const kind of authKinds) {
    const collection = dbc(kind);
    collection.createIndex({ created: 1 });
  }
}

// scheme for log entry as we receive it from the client
export const ZLogEntry = z.object({
  message: z.string(),
});
export type LogEntry = z.infer<typeof ZLogEntry>;

export const ZTimestampedLogEntry = ZLogEntry.extend({
  timestamp: z.date(),
});
export type TimestampedLogEntry = z.infer<typeof ZTimestampedLogEntry>;

// schema for the full log record stored in the satabase
export const ZRegistrySchema = z.object({
  _id: z.string(),
  object: z.literal("log"),
  created: z.date(),
  entries: z.array(ZTimestampedLogEntry),
});
export type LogSchema = z.infer<typeof ZRegistrySchema>;

// CRUD operations

// Create a new registry.
export async function createLog(
  initialEntry: LogEntry,
  auth: Auth,
): Promise<LogSchema> {
  auth.assertAccess(collectionName, undefined, "create");
  log("Creating log");
  const now = new Date();
  const document: LogSchema = {
    _id: randomIdentifier("log"),
    object: "log" as const,
    created: now,
    entries: [{ ...initialEntry, timestamp: now }],
  };

  try {
    await dbc(auth.kind).insertOne(document);
    log("Inserted", document);
    return document;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

// Add an entry to existing log
// Returns true if the log was updated, false if the log was not found
export async function appendLog(
  id: string,
  entry: LogEntry,
  auth: Auth,
): Promise<boolean> {
  auth.assertAccess(collectionName, id, "update");
  const now = new Date();
  try {
    const result = await dbc(auth.kind).updateOne(
      { _id: id },
      {
        $push: {
          entries: { ...entry, timestamp: now },
        },
      },
    );
    return result.modifiedCount === 1;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

// Get a log by id
// Returns null if the log is not found
export async function readLog(
  id: string,
  auth: Auth,
): Promise<LogSchema | null> {
  auth.assertAccess(collectionName, id, "read");
  try {
    return await dbc(auth.kind).findOne({ _id: id });
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

function regexEscape(text: string) {
  return text.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

// List logs
export async function listLogs(
  query: { text?: string },
  pagination: Pagination,
  auth: Auth,
) {
  auth.assertAccess(collectionName, undefined, "read");
  const match = query.text
    ? { "entries.message": new RegExp(regexEscape(query.text)) }
    : {};
  try {
    const docs = await paginate(dbc(auth.kind), pagination, [
      { $match: match },
    ]);
    return docs;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

// Delete a log by id
// Returns true if the log was deleted, false if the log was not found
export async function deleteLog(id: string, auth: Auth): Promise<boolean> {
  auth.assertAccess(collectionName, id, "delete");
  try {
    const result = await dbc(auth.kind).deleteOne({ _id: id });
    return result.deletedCount === 1;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}
