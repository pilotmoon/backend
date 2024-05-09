import { STATUS_CODES } from "node:http";
import { AxiosError } from "axios";
import { MongoServerError } from "mongodb";
import { ZodError, z } from "zod";
import { fromZodError } from "zod-validation-error";
import { PositiveSafeInteger } from "./saneSchemas.js";

export const ZProblemDetails = z
  .object({
    type: z.string(),
    status: PositiveSafeInteger.optional(),
    title: z.string().optional(),
    detail: z.string().optional(),
    instance: z.string().optional(),
  })
  .passthrough();
export type ProblemDetails = z.infer<typeof ZProblemDetails>;

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
  innerMessage?: string;
  type: string;
  status: number;
  stack?: string;
}

// extract concrete info from an unknown error
export function getErrorInfo(error: unknown): ErrorInfo {
  // get some kind of message
  let message;
  let innerMessage = undefined;
  let type;
  let status = 500;
  if (error instanceof ApiError) {
    type = "ApiError";
    message = error.message;
    status = error.status;
  }
  if (error instanceof ZodError) {
    type = "ZodError";
    message = fromZodError(error).message;
    status = 400;
  } else if (error instanceof AxiosError) {
    type = "AxiosError";
    message = error.message;
    status = error.response?.status ?? status;
    innerMessage = error.response?.headers["x-error-message"];
  } else if (error instanceof Error) {
    type = error.name;
    message = error.message;
  } else {
    type = "UnknownError";
    message = String(error);
  }

  let stack = undefined;
  if (error instanceof Error) {
    stack = error.stack;
  }

  return { message, innerMessage, type, status, stack };
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
