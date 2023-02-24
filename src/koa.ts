/*
Wrap Koa's types to inject our own state type.
*/
import Koa = require("koa");
import Router = require("@koa/router");
import { AuthContext } from "./controllers/authController";
import { PaginateState } from "./middleware/paginate";

interface State extends Koa.DefaultState {
  // items set by authMiddleware
  auth: AuthContext;
  apiKeyId: string;

  // items set by paginator
  paginate: PaginateState;

  // items set by error handling middleware
  error?: any;
}

interface Context extends Koa.DefaultContext {
  // function to generate Location header
  location(name: string, params?: any): string;
}

export function makeServer() {
  return new Koa<State, Context>({ proxy: true });
}

export function makeRouter(opt?: Router.RouterOptions) {
  return new Router<State, Context>(opt);
}
