import { log } from "../logger.js";
import { CronJob } from "cron";
import { getRolo } from "./rolo.js";
import { config } from "./config.js";
import { z } from "zod";
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
const reportsConfig = ZConfig.parse(JSON.parse(config.REPORTS_CONFIG));

// call once on server start
let weeklyJob: CronJob;
let monthlyJob: CronJob;
let testJob: CronJob;
export function start() {
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
  testJob?.stop();
}

async function testReport() {
  // summaryReport("reportsTest@pilotmoon.com");
  studentAppCentreReport();
}

async function summaryReport(overrideTo: string | undefined = undefined) {
  try {
    log("Summary report", new Date());
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // today at 00:00:00
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getDate() - 7); // 7 days ago at 00:00:00

    // get license keys created yesterday
    const api = getRolo("live");
    const { data } = await api.get("reports/summary", {
      params: {
        gteDate: yesterday,
        ltDate: today,
      },
    });
    const reportText = JSON.stringify(data, undefined, 2);

    // send email
    const { transporter } = await import("./email.js");
    const mailOptions = {
      ...reportsConfig.summary,
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
    const api = getRolo("live");
    const { data: csvText } = await api.get("reports/licenseKeys", {
      params: {
        couponPrefix: "STU",
        format: "csv",
        gteDate: firstOfMonthMinus2,
        ltDate: firstOfMonthMinus1,
      },
    });
    // generate filename for attachment
    const month = firstOfMonthMinus2.toISOString().slice(0, 7);
    const filename = `STU-coupon-codes-${month}.csv`;
    log("filename", filename);
    // send email

    const { transporter } = await import("./email.js");
    const mailOptions = {
      ...reportsConfig.studentAppCentre,
      subject: "Coupon codes report",
      text: reportsConfig.studentAppCentre.body,
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
