import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { Context } from "koa";
import { STATUS_CODES } from "node:http";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = this.constructor.name;
  }
}

function getErrorMessage(error: unknown) {
  let message = "???";
  if (error instanceof ZodError) {
    message = fromZodError(error).message;
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }
  if (
    error !== null &&
    typeof error === "object" &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    message += ` (${error.name})`;
  }
  return message;
}

function getErrorStatus(error: unknown) {
  if (error instanceof ApiError) {
    return error.status;
  }
  if (error instanceof ZodError) {
    return 400; // Bad request
  }
  return 500; // Internal server error
}

export function reportError(
  error: unknown,
  ctx: Context,
) {
  const message = getErrorMessage(error);
  ctx.status = getErrorStatus(error);
  ctx.body = `${STATUS_CODES[ctx.status] ?? "???"}\n${message}`;
  console.log(
    "Response status ".red + String(ctx.status).blue +
      " with message ".red + message.blue,
  );
}
