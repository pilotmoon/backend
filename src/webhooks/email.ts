import nodemailer from "nodemailer";
import { z } from "zod";
import { config } from "./config.js";
const ZConfig = z.object({
  host: z.string(),
  port: z.number(),
  secure: z.boolean(),
  auth: z.object({
    user: z.string(),
    pass: z.string(),
  }),
});
const smtpConfig = ZConfig.parse(JSON.parse(config.SMTP_CONFIG));

export const transporter = nodemailer.createTransport(smtpConfig);
