import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config.js";
import { z } from "zod";
import axios from "axios";
import { log } from "console";

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
        CacheControl: "public, max-age=31536000, immutable",
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

export async function exists(key: string): Promise<string> {
  const url = `${spacesConfig.endpoint}/${spacesConfig.bucket}/${key}`;
  log("checking if exists: " + url);
  try {
    const response = await axios.head(url);
    if (response.status === 200) {
      return `${spacesConfig.cdnEndpoint}/${key}`;
    }
  } catch (err) {
    // nothing
  }
  return "";
}
