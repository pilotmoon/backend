import Router from "@koa/router";
/*
Wrap Koa's types to inject our own state type.
*/
import Koa from "koa";
import { Auth } from "./auth.js";
import { Pagination } from "./paginate";

export interface AppState extends Koa.DefaultState {
  // items set by auth midddleware
  auth: Auth;
  apiKeyId: string;

  // items set by paginator middleware
  pagination: Pagination;
}

export interface AppContext extends Koa.DefaultContext {
  // function to generate a URL for the Location header or other purposes
  // name: name of the route
  // params: parameters to pass to the route
  // query: query parameters to add to the URL
  // full: if true, return a full URL including the app's base URL
  getLocation(
    name: string,
    params?: Record<string, string>,
    query?: Record<string, string>,
  ): string;
  state: AppState;
}

export function makeServer() {
  return new Koa<AppState, AppContext>({ proxy: true });
}

export function makeRouter(opt?: Router.RouterOptions) {
  return new Router<AppState, AppContext>(opt);
}
