import { Context, Next } from "koa";
import { formatResponse, getErrorInfo, prettyFormatStatus } from "../errors.js";
import { log } from "../log.js";

function cleanHttpHeaderString(s: string) {
  return s.replace(/[\n\r]/g, " ");
}

export async function handleError(ctx: Context, next: Next) {
  let info;
  try {
    log(`\n${`${ctx.method} ${ctx.url}`.black.bgBlue}`);
    await next();
  } catch (error) {
    info = getErrorInfo(error);
    ctx.body = formatResponse(info);
    ctx.set("X-Error-Message", cleanHttpHeaderString(info.message));
    ctx.status = info.status;
  } finally {
    log(
      `${prettyFormatStatus(ctx.status)}`,
      `Sending ${ctx.response.length ?? 0} bytes`,
    );
    if (info) {
      log(`${info.type.black.bgWhite} ${info.message}`);
    }
  }
}
