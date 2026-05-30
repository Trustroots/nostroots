import { z } from "../deps.ts";
import { isPlusCode } from "./utils.ts";

export const PlusCodeSchema = z
  .string()
  .min(9, "Plus code must be 9 or more characters #INU7zO")
  .refine(
    (maybePlusCode) => isPlusCode(maybePlusCode),
    "Must be valid plus code #PeCssP",
  );

export type PlusCode = z.infer<typeof PlusCodeSchema>;
