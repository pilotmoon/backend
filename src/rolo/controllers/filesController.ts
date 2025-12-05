import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GridFSBucket, MongoServerError, ObjectId } from "mongodb";
import { ApiError, handleControllerError } from "../../common/errors.js";
import {
  type FileCreateInput,
  type FileRecord,
  ZFileCreateInput,
  ZFileRecord,
} from "../../common/fileSchemas.js";
import { type Auth, type AuthKind, authKinds } from "../auth.js";
import { getDb } from "../database.js";
import { prefixedObjectIdRegex } from "../identifiers.js";
import { type Pagination, paginate } from "../paginate.js";

const collectionName = "files";
const bucketName = "files";
const fileIdPrefix = "file";
const fileIdRegex = prefixedObjectIdRegex(fileIdPrefix);

function toFileId(objectId: ObjectId): string {
  return `${fileIdPrefix}_${objectId.toHexString()}`;
}

function toObjectId(id: string): ObjectId | null {
  const match = fileIdRegex.exec(id);
  if (!match) {
    return null;
  }
  try {
    return new ObjectId(match[1]);
  } catch {
    return null;
  }
}

const bucketCache = new Map<AuthKind, GridFSBucket>();
function getBucket(kind: AuthKind) {
  const cached = bucketCache.get(kind);
  if (cached) return cached;
  const bucket = new GridFSBucket(getDb(kind), { bucketName });
  bucketCache.set(kind, bucket);
  return bucket;
}

type GridFsFileDocument = {
  _id: ObjectId;
  filename: string;
  length: number;
  uploadDate: Date;
  created?: Date;
};

function filesCollection(kind: AuthKind) {
  return getDb(kind).collection<GridFsFileDocument>(`${bucketName}.files`);
}

function toRecord(document: GridFsFileDocument): FileRecord {
  return ZFileRecord.parse({
    _id: toFileId(document._id),
    object: "file",
    name: document.filename,
    size: document.length,
    created: document.created ?? document.uploadDate,
  });
}

// One-time setup for collections and indexes
export async function init() {
  for (const kind of authKinds) {
    const collection = filesCollection(kind);
    await collection.createIndex({ filename: 1 }, { unique: true });
    await collection.createIndex({ created: 1 });
  }
}

export async function createFile(
  source: Readable,
  suppliedInput: unknown,
  auth: Auth,
): Promise<FileRecord> {
  auth.assertAccess(collectionName, undefined, "create");
  const parsedInput: FileCreateInput = ZFileCreateInput.parse(suppliedInput);
  const bucket = getBucket(auth.kind);
  const gridFsId = new ObjectId();
  const now = new Date();
  const uploadStream = bucket.openUploadStreamWithId(
    gridFsId,
    parsedInput.name,
  );
  try {
    await pipeline(source, uploadStream);
  } catch (error) {
    await bucket.delete(gridFsId).catch(() => {});
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new ApiError(409, "File name already exists");
    }
    throw error;
  }

  try {
    const document = await filesCollection(auth.kind).findOneAndUpdate(
      { _id: gridFsId },
      {
        $set: {
          created: now,
        },
      },
      { returnDocument: "after" },
    );
    if (!document) {
      throw new ApiError(500, "Unable to read stored file metadata");
    }
    return toRecord(document);
  } catch (error) {
    await bucket.delete(gridFsId).catch(() => {});
    handleControllerError(error);
    throw error;
  }
}

export async function readFileById(
  id: string,
  auth: Auth,
): Promise<FileRecord | null> {
  auth.assertAccess(collectionName, id, "read");
  const objectId = toObjectId(id);
  if (!objectId) {
    return null;
  }
  const document = await filesCollection(auth.kind).findOne({
    _id: objectId,
  });
  if (!document) return null;
  try {
    return toRecord(document);
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

async function findDocumentByName(name: string, kind: AuthKind) {
  return filesCollection(kind).findOne({ filename: name });
}

export async function streamFileByName(
  name: string,
  auth: Auth,
): Promise<{ record: FileRecord; stream: Readable } | null> {
  auth.assertAccess(collectionName, undefined, "read");
  const document = await findDocumentByName(name, auth.kind);
  if (!document) return null;
  try {
    const bucket = getBucket(auth.kind);
    const stream = bucket.openDownloadStream(document._id);
    return { record: toRecord(document), stream };
  } catch (_) {
    throw new ApiError(500, "Unable to read stored file");
  }
}

export async function listFiles(
  pagination: Pagination,
  auth: Auth,
): Promise<FileRecord[]> {
  auth.assertAccess(collectionName, undefined, "read");
  try {
    const docs = await paginate(filesCollection(auth.kind), pagination);
    return docs.map(toRecord);
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

export async function deleteFile(id: string, auth: Auth): Promise<boolean> {
  auth.assertAccess(collectionName, id, "delete");
  const objectId = toObjectId(id);
  if (!objectId) {
    return false;
  }
  const bucket = getBucket(auth.kind);
  const document = await filesCollection(auth.kind).findOne({ _id: objectId });
  if (!document) {
    return false;
  }
  try {
    await bucket.delete(objectId);
    return true;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}
