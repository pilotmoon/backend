import { ApiError } from "../../errors.js";
import { generateSummaryReport } from "../controllers/reportsController.js";
import { makeRouter } from "../koaWrapper.js";

export const router = makeRouter({ prefix: "/reports" });

function yesterday() {
  const result = new Date();
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

function add1Day(date: Date) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

// health check endpoint
router.get("/summary", async (ctx) => {
  // default start date to yesterday 00:00:00
  const gteDate = ctx.state.pagination.gteDate
    ? ctx.state.pagination.gteDate
    : yesterday();
  // default end date to start date + 1 day
  const ltDate = ctx.state.pagination.ltDate
    ? ctx.state.pagination.ltDate
    : add1Day(gteDate);
  // error if date range is invalid
  if (ltDate <= gteDate) throw new ApiError(400, "Invalid date range");

  ctx.body = {
    "object": "report",
    "dateRange": [gteDate, ltDate],
    "reportType": "summary",
    "report": await generateSummaryReport(ctx.state.auth, gteDate, ltDate),
  };
});
