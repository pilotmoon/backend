"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_PORT = exports.DATABASE_NAME = exports.DATABASE_URL = void 0;
exports.DATABASE_URL = process.env.DATABASE_URL ?? "";
exports.DATABASE_NAME = "testdb";
exports.APP_PORT = parseInt(process.env.APP_PORT ?? "8000");
