import { type Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GridFSBucket, ObjectId } from "mongodb";
import { z } from "zod";
import { ApiError, handleControllerError } from "../../common/errors.js";
import {
  type FileCreateInput,
  type FileRecord,
  ZFileCreateInput,
  ZFileRecord,
  ZFileUpdateInput,
} from "../../common/fileSchemas.js";
import { type Auth, type AuthKind, authKinds } from "../auth.js";
import { getDb } from "../database.js";
import { randomIdentifier } from "../identifiers.js";
import { type Pagination, paginate } from "../paginate.js";

const collectionName = "files";
const bucketName = "files";

const ZFileDbRecord = ZFileRecord.extend({
  gridFsId: z.instanceof(ObjectId),
});
type FileDbRecord = z.infer<typeof ZFileDbRecord>;

function dbc(kind: AuthKind) {
  return getDb(kind).collection<FileDbRecord>(collectionName);
}

const bucketCache = new Map<AuthKind, GridFSBucket>();
function getBucket(kind: AuthKind) {
  const cached = bucketCache.get(kind);
  if (cached) return cached;
  const bucket = new GridFSBucket(getDb(kind), { bucketName });
  bucketCache.set(kind, bucket);
  return bucket;
}

function toRecord(document: FileDbRecord): FileRecord {
  const { gridFsId: _gridFsId, ...rest } = document;
  return ZFileRecord.parse(rest);
}

// One-time setup for collections and indexes
export async function init() {
  for (const kind of authKinds) {
    const collection = dbc(kind);
    await collection.createIndex({ name: 1 }, { unique: true });
    await collection.createIndex({ created: 1 });
    await collection.createIndex({ hidden: 1 });
  }
}

async function ensureUniqueName(name: string, kind: AuthKind): Promise<void> {
  const existing = await dbc(kind).findOne({ name });
  if (existing) {
    throw new ApiError(409, "File name already exists");
  }
}

function makeCountingStream(onBytes: (size: number) => void) {
  return new Transform({
    transform(chunk, _encoding, callback) {
      onBytes(chunk.length);
      callback(null, chunk);
    },
  });
}

export async function createFile(
  source: Readable,
  suppliedInput: unknown,
  auth: Auth,
): Promise<FileRecord> {
  auth.assertAccess(collectionName, undefined, "create");
  const parsedInput: FileCreateInput = ZFileCreateInput.parse(suppliedInput);
  await ensureUniqueName(parsedInput.name, auth.kind);
  const bucket = getBucket(auth.kind);
  const gridFsId = new ObjectId();
  const uploadStream = bucket.openUploadStreamWithId(gridFsId, "");
  let size = 0;
  const counter = makeCountingStream((bytes) => {
    size += bytes;
  });
  try {
    await pipeline(source, counter, uploadStream);
  } catch (error) {
    await bucket.delete(gridFsId).catch(() => {});
    throw error;
  }

  const now = new Date();
  const document: FileDbRecord = {
    _id: randomIdentifier("file"),
    object: "file",
    name: parsedInput.name,
    size,
    hidden: false,
    created: now,
    gridFsId,
  };
  try {
    await dbc(auth.kind).insertOne(document);
  } catch (error) {
    await bucket.delete(gridFsId).catch(() => {});
    handleControllerError(error);
    throw error;
  }
  return toRecord(document);
}

export async function readFileById(
  id: string,
  auth: Auth,
): Promise<FileRecord | null> {
  auth.assertAccess(collectionName, id, "read");
  const document = await dbc(auth.kind).findOne({ _id: id });
  if (!document) return null;
  try {
    return toRecord(document);
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

async function findDocumentByName(
  name: string,
  kind: AuthKind,
  requirePublished: boolean,
) {
  const match: Record<string, unknown> = { name };
  if (requirePublished) {
    match.hidden = { $ne: true };
  }
  return dbc(kind).findOne(match);
}

export async function streamFileByName(
  name: string,
  auth: Auth,
): Promise<{ record: FileRecord; stream: Readable } | null> {
  auth.assertAccess(collectionName, undefined, "read");
  const document = await findDocumentByName(name, auth.kind, true);
  if (!document) return null;
  try {
    const bucket = getBucket(auth.kind);
    const stream = bucket.openDownloadStream(document.gridFsId);
    return { record: toRecord(document), stream };
  } catch (_) {
    throw new ApiError(500, "Unable to read stored file");
  }
}

export async function updateFile(
  id: string,
  suppliedInput: unknown,
  auth: Auth,
): Promise<FileRecord | null> {
  auth.assertAccess(collectionName, id, "update");
  const update = ZFileUpdateInput.parse(suppliedInput);
  const existing = await readFileById(id, auth);
  if (!existing) {
    return null;
  }
  const nextRecord = {
    ...existing,
    ...update,
  };
  try {
    await dbc(auth.kind).updateOne(
      { _id: id },
      {
        $set: {
          ...update,
        },
      },
    );
    return nextRecord;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

export async function listFiles(
  pagination: Pagination,
  auth: Auth,
): Promise<FileRecord[]> {
  auth.assertAccess(collectionName, undefined, "read");
  try {
    const docs = await paginate(dbc(auth.kind), pagination);
    return docs.map(toRecord);
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}
