import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config.js";
import { z } from "zod";

const ZConfig = z.object({
  endpoint: z.string(),
  cdnEndpoint: z.string(),
  region: z.string(),
  bucket: z.string(),
  credentials: z.object({
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
  }),
});
const spacesConfig = ZConfig.parse(
  JSON.parse(config.SPACES_CONFIG),
);

const s3Client = new S3Client({
  endpoint: spacesConfig.endpoint,
  region: spacesConfig.region,
  credentials: spacesConfig.credentials,
  forcePathStyle: false,
});

export async function upload(
  key: string,
  body: ArrayBuffer,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<string> {
  try {
    const data = await s3Client.send(
      new PutObjectCommand({
        Bucket: spacesConfig.bucket,
        Key: key,
        Body: body,
        ACL: "public-read",
        ContentType: contentType,
        CacheControl: "public, max-age=604800, immutable",
        Metadata: metadata,
      }),
    );
    console.log("Successfully uploaded object: ", key);
    return `${spacesConfig.cdnEndpoint}/${key}`;
  } catch (err) {
    console.log("Error", err);
    throw err;
  }
}
