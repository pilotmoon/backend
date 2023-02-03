"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Koa = require("koa");
const mongoose_1 = require("mongoose");
// database test
const testDb = async function () {
    mongoose_1.default.set('strictQuery', false);
    await mongoose_1.default.connect(process.env.DATABASE_URL ?? '', { dbName: 'testdb' });
    mongoose_1.default.connection.useDb('testdb');
    const Cat = mongoose_1.default.model('Cat', { name: String });
    const kitty = new Cat({ name: 'Konstantin' });
    kitty.save().then(() => console.log('meow'));
};
void testDb();
// koa
const app = new Koa();
app.use((ctx) => {
    ctx.body = 'Hello World, from koa.';
});
app.listen(parseInt(process.env.APP_PORT ?? '8000'));
