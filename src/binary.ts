import { Binary } from "mongodb";
import { z } from "zod";

export const ZMongoBinary = z.custom<Binary>((v) => v instanceof Binary);
