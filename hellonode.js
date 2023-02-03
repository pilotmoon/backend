'use strict';

const Koa = require('koa');
const app = new Koa();

app.use(ctx => {
  ctx.body = 'Hello World, from koa.';
});

app.listen(1234);