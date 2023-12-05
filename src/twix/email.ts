import nodemailer from "nodemailer";
import { z } from "zod";
import { log } from "../common/log.js";
import { getRemoteConfig } from "./remoteConfig.js";
const ZConfig = z.object({
  host: z.string(),
  port: z.number(),
  secure: z.boolean(),
  auth: z.object({
    user: z.string(),
    pass: z.string(),
  }),
});

let config: z.infer<typeof ZConfig>;
async function getConfig() {
  if (!config) {
    config = ZConfig.parse(await getRemoteConfig("smtp_credentials"));
  }
  return config;
}

export const transporter = nodemailer.createTransport(await getConfig());
