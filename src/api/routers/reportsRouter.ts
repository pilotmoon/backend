import { ApiError } from "../../errors.js";
import { makeRouter } from "../koaWrapper.js";

export const router = makeRouter({ prefix: "/reports" });

function yesterday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
}

// health check endpoint
router.get("/summary", async (ctx) => {
  ctx.state.auth.assertAccess("reports", undefined, "read");

  // default start date to yesterday 00:00:00
  const gteDate = ctx.state.pagination.gteDate
    ? ctx.state.pagination.gteDate
    : yesterday();
  // default end date to start date + 1 day
  const ltDate = ctx.state.pagination.ltDate
    ? ctx.state.pagination.ltDate
    : new Date(
      gteDate.getFullYear(),
      gteDate.getMonth(),
      gteDate.getDate() + 1,
    );
  // error if date range is invalid
  if (ltDate <= gteDate) throw new ApiError(400, "Invalid date range");

  ctx.body = {
    "object": "report",
    "dateRange": [gteDate, ltDate],
    "report": generateSummaryReport(gteDate, ltDate),
  };
});

function generateSummaryReport(gteDate: Date, ltDate: Date) {
  return { foo: "bar" };
}
