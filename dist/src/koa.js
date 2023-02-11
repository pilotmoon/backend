"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeRouter = exports.makeServer = void 0;
/*
Wrap Koa's types to inject our own state type.
*/
const Koa = require("koa");
const Router = require("@koa/router");
function makeServer() {
  return new Koa({ proxy: true });
}
exports.makeServer = makeServer;
function makeRouter(opt) {
  return new Router(opt);
}
exports.makeRouter = makeRouter;
