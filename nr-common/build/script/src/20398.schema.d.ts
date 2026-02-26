import { z } from "../deps.js";
export declare const kind20398EventSchema: z.ZodObject<{
    created_at: z.ZodNumber;
    id: z.ZodString;
    pubkey: z.ZodString;
    sig: z.ZodString;
} & {
    kind: z.ZodLiteral<20398>;
    content: z.ZodString;
    tags: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">, string[][], string[][]>, string[][], string[][]>, string[][], string[][]>;
}, "strict", z.ZodTypeAny, {
    kind: 20398;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}, {
    kind: 20398;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}>;
export type Kind20398Event = z.infer<typeof kind20398EventSchema>;
