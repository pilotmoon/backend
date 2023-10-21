import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config.js";
import { boolean, z } from "zod";
import axios from "axios";
import { log } from "console";
import { result } from "lodash";

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
  path: string,
  body: ArrayBuffer,
  contentType: string,
  metadata?: Record<string, string>,
) {
  try {
    console.log("s3: sending".magenta, path.bgWhite);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: spacesConfig.bucket,
        Key: path,
        Body: body,
        ACL: "public-read",
        ContentType: contentType,
        CacheControl: "public, max-age=3600",
        Metadata: metadata,
      }),
    );
    console.log("s3: sent".magenta, path.bgWhite);
  } catch (err) {
    console.log("s3: error".bgRed, err);
    throw err;
  }
}

export async function exists(path: string) {
  var result = false;
  const url = `${spacesConfig.endpoint}/${spacesConfig.bucket}/${path}`;
  log("s3: exists?".magenta, path.bgWhite);
  try {
    const response = await axios.head(url);
    if (response.status === 200) {      
      result = true;
    }
  } catch (err) {
    // nothing
  }
  log("s3: exists ".magenta);
  return result;
}
