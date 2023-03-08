import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { Context, Next } from "koa";
import { STATUS_CODES } from "node:http";
import { ApiError } from "../../errors";
import { log } from "../../logger";

// type to represent information about an error
interface ErrorInfo {
  message: string;
  type: string;
  status: number;
}

// extract concrete info from an unknown error
function getErrorInfo(error: unknown): ErrorInfo {
  // get some kind of message
  let message;
  if (error instanceof ZodError) {
    message = fromZodError(error).message;
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }

  // try to get type name from error
  let type = "UnknownError";
  if (
    typeof error === "object" && error !== null &&
    "name" in error && typeof error.name === "string"
  ) {
    type = error.name;
  }

  // adjust status code for known errors
  let status = 500;
  if (error instanceof ApiError) {
    status = error.status;
  } else if (error instanceof ZodError) {
    status = 400;
  }

  return { message, type, status };
}

function httpStatusString(code: number, { showCode = true } = {}) {
  const string = STATUS_CODES[code];
  if (string) {
    return showCode ? `${code} ${string}` : string;
  } else {
    return "???";
  }
}

// pretty print status code for logging
function prettyFormatStatus(status: number) {
  let s = httpStatusString(status);
  if (status >= 200 && status < 300) {
    s = s.bgGreen;
  } else if (status >= 400 && status < 500) {
    s = s.bgYellow;
  } else if (status >= 500 && status < 600) {
    s = s.white.bgRed;
  } else {
    s = s.bgWhite;
  }
  return s;
}

// format the error info as it will be sent to the client
function formatResponse(info: ErrorInfo) {
  let result = httpStatusString(info.status, { showCode: false });
  if (info.status < 500) result += ` (${info.message})`;
  return result;
}

export async function handleError(ctx: Context, next: Next) {
  let info;
  try {
    log("\n" + `${ctx.method} ${ctx.path}`.bgBlue);
    await next();
  } catch (error) {
    info = getErrorInfo(error);
    ctx.body = formatResponse(info);
    ctx.status = info.status;
  } finally {
    log(
      `${prettyFormatStatus(ctx.status)}`,
      `Sending ${ctx.response.length ?? 0} bytes`,
    );
    if (info) {
      log(`${info.type.bgWhite} ${info.message}`);
    }
  }
}
