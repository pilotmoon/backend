import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GridFSBucket, MongoServerError, ObjectId } from "mongodb";
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
import { type Pagination, paginate } from "../paginate.js";

const collectionName = "files";
const bucketName = "files";
const fileIdPrefix = "file_";
const fileIdRegex = /^file_([0-9a-f]{24})$/i;

function toFileId(objectId: ObjectId): string {
  return `${fileIdPrefix}${objectId.toHexString()}`;
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

type GridFsMetadata = {
  hidden?: boolean;
};

type GridFsFileDocument = {
  _id: ObjectId;
  filename: string;
  length: number;
  uploadDate: Date;
  created?: Date;
  metadata?: GridFsMetadata;
};

function filesCollection(kind: AuthKind) {
  return getDb(kind).collection<GridFsFileDocument>(`${bucketName}.files`);
}

function toRecord(document: GridFsFileDocument): FileRecord {
  const metadata = document.metadata ?? {};
  return ZFileRecord.parse({
    _id: toFileId(document._id),
    object: "file",
    name: document.filename,
    size: document.length,
    hidden: metadata.hidden ?? false,
    created: document.created ?? document.uploadDate,
  });
}

// One-time setup for collections and indexes
export async function init() {
  for (const kind of authKinds) {
    const collection = filesCollection(kind);
    await collection.createIndex({ filename: 1 }, { unique: true });
    await collection.createIndex({ created: 1 });
    await collection.createIndex({ "metadata.hidden": 1 });
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
    {
      metadata: {
        hidden: false,
      },
    },
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

async function findDocumentByName(
  name: string,
  kind: AuthKind,
  requirePublished: boolean,
) {
  const match: Record<string, unknown> = { filename: name };
  if (requirePublished) {
    match["metadata.hidden"] = { $ne: true };
  }
  return filesCollection(kind).findOne(match);
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
    const stream = bucket.openDownloadStream(document._id);
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
  const objectId = toObjectId(id);
  if (!objectId) {
    return null;
  }
  const update = ZFileUpdateInput.parse(suppliedInput);
  try {
    const document = await filesCollection(auth.kind).findOneAndUpdate(
      { _id: objectId },
      {
        $set: {
          "metadata.hidden": update.hidden,
        },
      },
      { returnDocument: "after" },
    );
    if (!document) {
      return null;
    }
    return toRecord(document);
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
    const docs = await paginate(filesCollection(auth.kind), pagination);
    return docs.map(toRecord);
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}
