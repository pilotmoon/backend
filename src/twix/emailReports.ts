import { CronJob } from "cron";
import { z } from "zod";
import { log } from "../common/log.js";
import type { AuthKind } from "../rolo/auth.js";
import { getTransporter } from "./email.js";
import { getRemoteConfig } from "./remoteConfig.js";
import { getRolo } from "./rolo.js";

const ZReportConfig = z.object({
  from: z.string(),
  to: z.string(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  replyTo: z.string().optional(),
  body: z.string().optional(),
});
const ZConfig = z.object({
  summary: ZReportConfig,
  studentAppCentre: ZReportConfig,
});

let config: z.infer<typeof ZConfig>;
async function getConfig() {
  if (!config) {
    config = ZConfig.parse(await getRemoteConfig("reports_config"));
  }
  return config;
}

//call once on server start
let weeklyJob: CronJob;
let monthlyJob: CronJob;
//let testJob: CronJob;
export async function start() {
  await getConfig();

  log("Starting reports...");
  weeklyJob = new CronJob(
    "7 7 2 * * 1", // every Monday at 02:07:07
    summaryReport,
    null,
    true,
    "utc",
  );
  monthlyJob = new CronJob(
    "8 8 2 1 * *", // every 1st of the month at 02:08:08
    studentAppCentreReport,
    null,
    true,
    "utc",
  );
  // testJob = new CronJob(
  //   "*/10 * * * * *", // every 10 seconds
  //   testReport,
  //   null,
  //   true,
  //   "utc",
  // );
}

// call on server shutdown
export function stop() {
  log("Stopping reports");
  weeklyJob.stop();
  monthlyJob.stop();
  //testJob?.stop();
}

async function testReport() {
  summaryReport("reportstest@pilotmoon.com", "test");
  studentAppCentreReport("reportstest@pilotmoon.com", "live");
}

async function summaryReport(
  overrideTo: string | undefined = undefined,
  keyKind: AuthKind = "live",
) {
  try {
    log("Summary report", new Date());
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // today at 00:00:00
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getDate() - 7); // 7 days ago at 00:00:00

    // get license keys created yesterday
    const api = getRolo(keyKind);
    const { data } = await api.get("reports/summary", {
      params: {
        gteDate: yesterday,
        ltDate: today,
      },
    });
    const reportText = JSON.stringify(data, undefined, 2);

    // send email
    const transporter = await getTransporter();
    const mailOptions = {
      ...(await getConfig()).summary,
      subject: "Weekly summary report",
      text: reportText,
    };
    if (overrideTo) {
      mailOptions.to = overrideTo;
    }
    log("Sending email to ", mailOptions.to);
    await transporter.sendMail(mailOptions);
  } catch (e) {
    log("Error", e);
  } finally {
    log("Summary report done");
  }
}

async function studentAppCentreReport(
  overrideTo: string | undefined = undefined,
  keyKind: AuthKind = "live",
) {
  try {
    log("Student App Centre report", new Date());
    // get date range from 1st of month-2 to 1st of month-1
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // today at 00:00:00
    const firstOfThisMonth = new Date(today);
    firstOfThisMonth.setUTCDate(1); // 1st of this month at 00:00:00
    const firstOfMonthMinus1 = new Date(firstOfThisMonth);
    firstOfMonthMinus1.setUTCMonth(firstOfThisMonth.getMonth() - 1); // 1st of month-1 at 00:00:00
    const firstOfMonthMinus2 = new Date(firstOfThisMonth);
    firstOfMonthMinus2.setUTCMonth(firstOfThisMonth.getMonth() - 2); // 1st of month-2 at 00:00:00

    // fetch the STU coupon codes report
    const api = getRolo(keyKind);
    const { data: csvText } = await api.get("licenseKeys", {
      params: {
        gteDate: firstOfMonthMinus2,
        ltDate: firstOfMonthMinus1,
        couponPrefix: "STU",
        view: "financial",
        sort: 1,
        limit: 5000,
        format: "csv",
      },
    });
    // generate filename for attachment
    const month = firstOfMonthMinus2.toISOString().slice(0, 7);
    const filename = `STU-coupon-codes-${month}.csv`;
    log("filename", filename);
    // send email

    const transporter = await getTransporter();
    const mailOptions = {
      ...(await getConfig()).studentAppCentre,
      subject: "Coupon codes report",
      text: (await getConfig()).studentAppCentre.body,
      attachments: [
        {
          filename,
          content: csvText,
        },
      ],
    };
    if (overrideTo) {
      mailOptions.to = overrideTo;
    }
    log("Sending email to ", mailOptions.to);
    await transporter.sendMail(mailOptions);
  } catch (e) {
    log("Error", e);
  } finally {
    log("Student App Centre report done");
  }
}
