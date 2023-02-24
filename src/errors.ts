import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { Context } from "koa";
import { pickBy } from "lodash";
import { STATUS_CODES } from "node:http";
import { MongoServerError } from "mongodb";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = this.constructor.name;
  }
}

export function handleControllerError(error: unknown) {
  if (error instanceof MongoServerError && error.code === 11000) {
    throw new ApiError(409, "Unique constraint violation");
  } else if (error instanceof ZodError) {
    throw new ApiError(500, "Invalid document: " + error.message);
  }
}

function getErrorInfo(error: unknown) {
  let message;
  if (error instanceof ZodError) {
    message = fromZodError(error).message;
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }

  let type;
  if (
    error !== null &&
    typeof error === "object" &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    type = error.name;
  }

  let status = 500; // Internal server error
  if (error instanceof ApiError) {
    status = error.status;
  }
  if (error instanceof ZodError) {
    status = 400; // Bad request
  }

  return { message, type, status };
}

export function httpStatusString(code: number, { showCode = true } = {}) {
  const string = STATUS_CODES[code];
  if (string) {
    return showCode ? `${code} ${string}` : string;
  } else {
    return "???";
  }
}

export function reportError(
  error: unknown,
  ctx: Context,
) {
  const info = getErrorInfo(error);
  ctx.status = info.status;
  ctx.state.error = pickBy({
    message: info.message,
    type: info.type,
    status: httpStatusString(info.status),
  });
  let body = httpStatusString(info.status, { showCode: false });
  if (info.status < 500) {
    body += ` (${info.message})`;
  }
  ctx.body = body;
}
