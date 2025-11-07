import { z } from "../deps.js";
export declare const PlusCodeSchema: z.ZodEffects<z.ZodString, string, string>;
export type PlusCode = z.infer<typeof PlusCodeSchema>;
