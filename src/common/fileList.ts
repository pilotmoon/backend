import { z } from "zod";

const ZBaseFileListEntry = z.object({
  path: z.string(),
  executable: z.boolean(),
});

const ZBufferFileListEntry = ZBaseFileListEntry.merge(
  z.object({
    contentsBuffer: z.instanceof(Buffer),
  }),
);

const ZBase64FileListEntry = ZBaseFileListEntry.merge(
  z.object({
    contentsBase64: z.string(),
  }),
);

const ZBlobFileListEntry = ZBaseFileListEntry.merge(
  z.object({
    contentsHash: z.string(),
  }),
);

export const ZBufferFileList = z.array(ZBufferFileListEntry);
export type BufferFileList = z.infer<typeof ZBufferFileList>;

export const ZBase64FileList = z.array(ZBase64FileListEntry);
export type Base64FileList = z.infer<typeof ZBase64FileList>;

export const ZBlobFileList = z.array(ZBlobFileListEntry);
export type BlobFileList = z.infer<typeof ZBlobFileList>;
