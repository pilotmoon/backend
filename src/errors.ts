import { ZodError } from "zod";
import { fromZodError, isValidationErrorLike } from "zod-validation-error";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = this.constructor.name;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return fromZodError(error).message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error); // Fallback
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
  ctx: {
    set: (field: string, val: string) => void;
    body: unknown;
    status: number;
  },
) {
  const message = getErrorMessage(error);
  ctx.set("X-Error-Message", message);
  ctx.body = {
    error: {
      message: message,
    },
  };
  ctx.status = getErrorStatus(error);
  console.log(
    "Response status ".red + String(ctx.status).blue + " with message ".red +
      message.blue,
  );
}
