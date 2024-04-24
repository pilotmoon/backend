import { z } from "zod";
import { ZSaneString } from "../../common/saneSchemas.js";
import { ActivityLog } from "../activityLog.js";

export const ZSubmitGistPayload = z.object({
  url: ZSaneString,
});
export type SubmitGistPayload = z.infer<typeof ZSubmitGistPayload>;

export async function processGist(
  payload: SubmitGistPayload,
  alog: ActivityLog,
) {
  alog.log(`Processing gist: ${payload.url}`);
  return false;
}
