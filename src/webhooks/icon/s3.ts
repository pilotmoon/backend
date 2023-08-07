import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getRolo } from "../rolo.js";
import { z } from "zod";
import axios from "axios";
import { log } from "console";

let spacesConfig: any;
let s3Client: S3Client;
async function init() {
  console.log("init s3");

  // get spaces config from rolo registry
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
  spacesConfig = ZConfig.parse((await getRolo("live").get("registries/s3_cdn/objects/config")).data.record);

  // create s3 client
  s3Client = new S3Client({
    endpoint: spacesConfig.endpoint,
    region: spacesConfig.region,
    credentials: spacesConfig.credentials,
    forcePathStyle: false,
  });
}

export async function upload(
  key: string,
  body: ArrayBuffer,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<string> {
  if (!s3Client) {
    await init();
  }
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
