"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportError = exports.httpStatusString = exports.ApiError = void 0;
const zod_1 = require("zod");
const zod_validation_error_1 = require("zod-validation-error");
const lodash_1 = require("lodash");
const node_http_1 = require("node:http");
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = this.constructor.name;
  }
}
exports.ApiError = ApiError;
function getErrorInfo(error) {
  let message;
  if (error instanceof zod_1.ZodError) {
    message = (0, zod_validation_error_1.fromZodError)(error).message;
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
  if (error instanceof zod_1.ZodError) {
    status = 400; // Bad request
  }
  return { message, type, status };
}
function httpStatusString(code) {
  const string = node_http_1.STATUS_CODES[code];
  if (string) {
    return `${code} ${string}`;
  } else {
    return "???";
  }
}
exports.httpStatusString = httpStatusString;
function reportError(error, ctx) {
  const info = getErrorInfo(error);
  ctx.status = info.status;
  ctx.body = {
    error: (0, lodash_1.pickBy)({
      message: info.message,
      type: info.type,
      status: httpStatusString(info.status),
    }),
  };
  // Log the error
  console.log("error".bgWhite, String(info.type), "/", info.message);
}
exports.reportError = reportError;
