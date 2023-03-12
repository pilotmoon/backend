import { z } from "zod";

export const ZSaneString = z.string().trim().min(1).max(100);
