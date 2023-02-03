import Koa = require('koa')
import mongoose from 'mongoose'

// database test
const testDb = async function (): Promise<void> {
  mongoose.set('strictQuery', false)
  await mongoose.connect(process.env.DATABASE_URL ?? '', { dbName: 'testdb' })
  mongoose.connection.useDb('testdb')
  const Cat = mongoose.model<any>('Cat', { name: String })
  const kitty = new Cat({ name: 'Konstantin' })
  kitty.save().then(() => console.log('meow'))
}
void testDb()

// koa
const app = new Koa()
app.use((ctx) => {
  ctx.body = 'Hello World, from koa.'
})
app.listen(parseInt(process.env.APP_PORT ?? '8000'))
