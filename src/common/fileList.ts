import { z } from "zod";

const ZBaseFileListEntry = z.object({
  path: z.string(),
  exec: z.boolean(),
});

const ZBufferFileListEntry = ZBaseFileListEntry.merge(
  z.object({
    buffer: z.instanceof(Buffer),
  }),
);

const ZBlobFileListEntry = ZBaseFileListEntry.merge(
  z.object({
    hash: z.string(),
  }),
);

export const ZBufferFileList = z.array(ZBufferFileListEntry);
export type BufferFileList = z.infer<typeof ZBufferFileList>;

export const ZBlobFileList = z.array(ZBlobFileListEntry);
export type BlobFileList = z.infer<typeof ZBlobFileList>;
