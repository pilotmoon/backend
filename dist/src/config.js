"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  DATABASE_NAME: "testdb",
  APP_PORT: parseInt(process.env.APP_PORT ?? "8000"),
};
