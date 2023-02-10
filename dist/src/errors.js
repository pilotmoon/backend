"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportError = exports.ApiError = void 0;
const zod_1 = require("zod");
const zod_validation_error_1 = require("zod-validation-error");
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = this.constructor.name;
  }
}
exports.ApiError = ApiError;
function getErrorMessage(error) {
  if (error instanceof zod_1.ZodError) {
    return (0, zod_validation_error_1.fromZodError)(error).message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error); // Fallback
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
  ctx.set("X-Error-Message", message);
  ctx.body = "";
  ctx.status = getErrorStatus(error);
  console.log(
    "Response status ".red + String(ctx.status).blue + " with message ".red +
      message.blue,
  );
}
exports.reportError = reportError;
