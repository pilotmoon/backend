import { randomUUID } from "node:crypto";
import {
  LogSchema,
  ZLogEntry,
  appendLog,
  createLog,
  listLogs,
  readLog,
} from "../controllers/logsController.js";
import { makeIdentifierPattern } from "../identifiers.js";
import { makeRouter } from "../koaWrapper.js";
import { generateResourceToken } from "../resourceToken.js";

export const router = makeRouter({ prefix: "/logs" });
const matchId = {
  pattern: makeIdentifierPattern("id", "log"),
  uuid: randomUUID(),
};

// create new log
router.post("/", async (ctx) => {
  const params = ZLogEntry.strict().parse(ctx.request.body);
  const document = await createLog(params, ctx.state.auth);
  const token = generateResourceToken(
    "logs",
    document._id,
    ctx.state.auth.kind,
  );
  const url = ctx.getLocation(matchId.uuid, { id: document._id }, { token });
  ctx.body = { ...document, url };
  ctx.status = 201;
});

// append to log
router.patch(matchId.uuid, matchId.pattern, async (ctx) => {
  const params = ZLogEntry.strict().parse(ctx.request.body);
  if (await appendLog(ctx.params.id, params, ctx.state.auth)) {
    ctx.status = 204;
  }
});

// get log by id
router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readLog(ctx.params.id, ctx.state.auth);
  if (document) {
    if (ctx.query.format === "text") {
      ctx.body = textFormat(document);
    } else {
      ctx.body = document;
    }
  }
});

// list logs with optional query parameters
router.get("/", async (ctx) => {
  const documents = await listLogs(
    ctx.query,
    ctx.state.pagination,
    ctx.state.auth,
  );
  ctx.body = documents;
});

function textFormat(document: LogSchema) {
  const header =
    `Log ID: ${document._id}\n` +
    `Created: ${document.created.toISOString()}\n\n`;
  return (
    document.entries
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .reduce((acc, entry) => {
        // find time difference between entries
        const timeDiff = entry.timestamp.getTime() - document.created.getTime();
        return (
          acc +
          `[${formatTimeDifference(timeDiff)}]\n${entry.message.trim()}\n\n`
        );
      }, header) + "END"
  );
}

function formatTimeDifference(milliseconds: number) {
  // Constants for time unit conversions
  const msPerSecond = 1000;
  const msPerMinute = 60 * msPerSecond;
  const msPerHour = 60 * msPerMinute;

  // Calculate each time component
  const hours = Math.floor(milliseconds / msPerHour);
  const minutes = Math.floor((milliseconds % msPerHour) / msPerMinute);
  const seconds = Math.floor((milliseconds % msPerMinute) / msPerSecond);
  const millis = Math.floor(milliseconds % msPerSecond);

  // Format the output
  return `${hours}:${padZeroes(minutes)}:${padZeroes(seconds)}.${padZeroes(
    millis,
    3,
  )}`;
}

function padZeroes(number: number, length = 2) {
  return number.toString().padStart(length, "0");
}
