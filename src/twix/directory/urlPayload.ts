import { z } from "zod";
import { ZSaneString } from "../../common/saneSchemas.js";

export const ZSubmitUrlPayload = z.object({
  url: ZSaneString,
});

export type SubmitUrlPayload = z.infer<typeof ZSubmitUrlPayload>;
