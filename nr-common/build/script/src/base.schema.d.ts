import { z } from "../deps.js";
export declare const baseEventSchema: z.ZodObject<{
    id: z.ZodString;
    pubkey: z.ZodString;
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
    sig: z.ZodString;
}, "strict", z.ZodTypeAny, {
    id: string;
    pubkey: string;
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    sig: string;
}, {
    id: string;
    pubkey: string;
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    sig: string;
}>;
export type Event = z.infer<typeof baseEventSchema>;
export declare const tagsIncludingPlusCodeSchema: z.ZodEffects<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">, string[][], string[][]>;
export declare const contentSchema: z.ZodString;
//# sourceMappingURL=base.schema.d.ts.map