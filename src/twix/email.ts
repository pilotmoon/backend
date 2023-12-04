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
const smtpConfig = ZConfig.parse(await getRemoteConfig("smtp_credentials"));
log("SMTP config loaded".green);
export const transporter = nodemailer.createTransport(smtpConfig);
