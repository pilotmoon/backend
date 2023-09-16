import { log } from "../logger.js";
import { CronJob } from "cron";
import { getRolo } from "./rolo.js";
import { config } from "./config.js";
import { z } from "zod";
const ZConfig = z.object({
  daily: z.object({
    from: z.string(),
    to: z.string(),
    cc: z.string().optional(),
    bcc: z.string().optional(),
    replyTo: z.string().optional(),
  }),
});
const reportsConfig = ZConfig.parse(
  JSON.parse(config.REPORTS_CONFIG),
);


// call once on server start
var daily: CronJob;
export function start() {
  log("Starting reports...");
  daily = new CronJob(
    '7 7 0 * * *', // every day at 00:07:07
    dailyReport,
    null,
    true,
    'utc',
  );
}

// call on server shutdown
export function stop() {
  log("Stopping reports");
  daily.stop();
}

async function dailyReport() {
  try {
    log("Daily report", new Date());
    // today at 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // yesterday at 00:00:00
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    // get license keys created yesterday
    const api = getRolo("live");
    log("Getting yesterday's license keys");
    const { data } = await api.get("reports/summary", {
      params: {
        gteDate: yesterday,
        ltDate: today,
      },
    });
    
    const reportText = `License Keys created yesterday:

${JSON.stringify(data, undefined, 2)}`;
    
    log("Got", reportText);

    // send email
    log("Sending email");
    const { transporter } = await import("./email.js");
    await transporter.sendMail({...reportsConfig.daily,
      subject: "License Keys report for " + yesterday.toDateString(),
      text: reportText,
    });
  } catch (e) {
    log("Error", e);
  } finally {
    log("Daily report done");
  }
}
