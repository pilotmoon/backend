import { ApiError } from "../../errors.js";
import { generateReport } from "../controllers/reportsController.js";
import { makeRouter } from "../koaWrapper.js";

export const router = makeRouter({ prefix: "/reports" });

function daysAgo(days: number) {
  const result = new Date();
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// health check endpoint
router.get("/:name", async (ctx) => {
  // default start date to 30 days ago 00:00:00
  const gteDate = ctx.state.pagination.gteDate
    ? ctx.state.pagination.gteDate
    : daysAgo(7);
  // default end date to start date + 1 day
  const ltDate = ctx.state.pagination.ltDate
    ? ctx.state.pagination.ltDate
    : addDays(gteDate, 7);
  // error if date range is invalid
  if (ltDate <= gteDate) throw new ApiError(400, "Invalid date range");

  ctx.body = {
    "object": "report",
    "dateRange": [gteDate, ltDate],
    "reportType": ctx.params.name,
    "report": await generateReport(
      ctx.state.auth,
      gteDate,
      ltDate,
      ctx.params.name,
    ),
  };
});
