import { ZodError } from "zod";
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
