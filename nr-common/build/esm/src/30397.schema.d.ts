import { z } from "../deps.js";
export declare const kind30397EventSchema: z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
}, {
    id: z.ZodString;
    pubkey: z.ZodString;
    sig: z.ZodString;
}>, {
    kind: z.ZodLiteral<30397>;
    tags: z.ZodEffects<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">, string[][], string[][]>;
    content: z.ZodString;
}>, "strict", z.ZodTypeAny, {
    kind: 30397;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}, {
    kind: 30397;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}>;
