"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportError = exports.ApiError = void 0;
const zod_1 = require("zod");
const zod_validation_error_1 = require("zod-validation-error");
const node_http_1 = require("node:http");
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = this.constructor.name;
  }
}
exports.ApiError = ApiError;
function getErrorMessage(error) {
  let message = "???";
  if (error instanceof zod_1.ZodError) {
    message = (0, zod_validation_error_1.fromZodError)(error).message;
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
function getErrorStatus(error) {
  if (error instanceof ApiError) {
    return error.status;
  }
  if (error instanceof zod_1.ZodError) {
    return 400; // Bad request
  }
  return 500; // Internal server error
}
function reportError(error, ctx) {
  const message = getErrorMessage(error);
  ctx.status = getErrorStatus(error);
  ctx.body = `${node_http_1.STATUS_CODES[ctx.status] ?? "???"}\n${message}`;
  console.log(
    "Response status ".red + String(ctx.status).blue +
      " with message ".red + message.blue,
  );
}
exports.reportError = reportError;
