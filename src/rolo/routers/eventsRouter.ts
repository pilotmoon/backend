import { makeRouter } from "../koaWrapper.js";
import { createEvent, listEvents } from "../controllers/eventsController.js";
import { ZEventInfo } from "../../common/events.js";

export const router = makeRouter({ prefix: "/events" });

router.post("/", async (ctx) => {
  const info = ZEventInfo.parse(ctx.request.body);
  const document = await createEvent(info, ctx.state.auth);
  ctx.body = document;
  ctx.status = 201;
});

router.get("/", async (ctx) => {
  const documents = await listEvents(
    ctx.query,
    ctx.state.pagination,
    ctx.state.auth,
  );
  ctx.body = documents;
});
