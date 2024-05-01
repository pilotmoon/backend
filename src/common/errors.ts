import { STATUS_CODES } from "node:http";
import { AxiosError } from "axios";
import { MongoServerError } from "mongodb";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export function handleControllerError(error: unknown) {
  if (error instanceof MongoServerError && error.code === 11000) {
    throw new ApiError(409, `Unique constraint violation: ${error.message}`);
  }
  if (error instanceof ZodError) {
    throw new ApiError(500, `Invalid document: ${error.message}`);
  }
}

// type to represent information about an error
interface ErrorInfo {
  message: string;
  type: string;
  status: number;
  stack?: string;
}

// extract concrete info from an unknown error
export function getErrorInfo(error: unknown): ErrorInfo {
  // get some kind of message
  let message;
  let type;
  if (error instanceof ZodError) {
    type = "ZodError";
    message = fromZodError(error).message;
  } else if (error instanceof AxiosError) {
    type = "AxiosError";
    message = error.message;
    const innerError = error.response?.headers["x-error-message"];
    if (typeof innerError === "string") {
      message += ` / ${innerError}`;
    }
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }

  // try to get type name from error
  if (!type) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      typeof error.name === "string"
    ) {
      type = error.name;
    } else {
      type = "UnknownError";
    }
  }

  // adjust status code for known errors
  let status = 500;
  if (error instanceof ApiError) {
    status = error.status;
  } else if (error instanceof ZodError) {
    status = 400;
  }

  let stack = undefined;
  if (error instanceof Error) {
    stack = error.stack;
  }

  return { message, type, status, stack };
}

// get the string for a status code
function httpStatusString(code: number, { showCode = true } = {}) {
  const string = STATUS_CODES[code];
  if (string) {
    return showCode ? `${code} ${string}` : string;
  }
  return "???";
}

// pretty print status code for logging
export function prettyFormatStatus(status: number) {
  let s = httpStatusString(status);
  if (status >= 200 && status < 300) {
    s = s.black.bgGreen;
  } else if (status >= 400 && status < 500) {
    s = s.black.bgYellow;
  } else if (status >= 500 && status < 600) {
    s = s.white.bgRed;
  } else {
    s = s.black.bgWhite;
  }
  return s;
}

// format the error info as it will be sent to the client in body
export function formatResponse(info: ErrorInfo) {
  return `${httpStatusString(info.status)} (${info.message})`;
}
