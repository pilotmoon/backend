import { z } from "zod";

type GetBlobFunction = (entry: FileListEntry) => Promise<Buffer>;

export async function fileListGetBuffer(
  file: FileListEntry,
  getBlob?: GetBlobFunction,
) {
  if (file.type === "buffer") {
    return file.contentsBuffer;
  } else if (file.type === "base64") {
    return Buffer.from(file.contentsBase64, "base64");
  } else if (file.type === "blob") {
    if (!getBlob) throw new Error("getBlob function required");
    return getBlob(file);
  } else {
    throw new Error(`Unknown file type: ${(file as any).type}`);
  }
}

export async function fileListBufferify(
  fileList: FileList,
  getBlob?: GetBlobFunction,
) {
  return fileList.map((file) => ({
    type: "buffer" as const,
    path: file.path,
    contentsBuffer: fileListGetBuffer(file, getBlob),
    executable: file.executable,
  }));
}

const ZFileListEntry = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("buffer"),
    path: z.string(),
    contentsBuffer: z.instanceof(Buffer),
    executable: z.boolean(),
  }),
  z.object({
    type: z.literal("base64"),
    path: z.string(),
    contentsBase64: z.string(),
    executable: z.boolean(),
  }),
  z.object({
    type: z.literal("blob"),
    path: z.string(),
    contentsHash: z.string(),
    executable: z.boolean(),
  }),
]);
export type FileListEntry = z.infer<typeof ZFileListEntry>;

export const ZFileList = z.array(ZFileListEntry);
export type FileList = z.infer<typeof ZFileList>;
