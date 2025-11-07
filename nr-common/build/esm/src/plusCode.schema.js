import { z } from "../deps.js";
import { isPlusCode } from "./utils.js";
export const PlusCodeSchema = z
    .string()
    .min(9, "Plus code must be 9 or more characters #INU7zO")
    .refine((maybePlusCode) => isPlusCode(maybePlusCode), "Must be valid plus code #PeCssP");
