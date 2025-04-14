import { z } from "../deps.js";
export declare const baseEventTemplateSchema: z.ZodObject<{
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
}, {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
}>;
export declare const finalizedEventFields: z.ZodObject<{
    id: z.ZodString;
    pubkey: z.ZodString;
    sig: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    pubkey: string;
    sig: string;
}, {
    id: string;
    pubkey: string;
    sig: string;
}>;
export declare const baseEventSchema: z.ZodObject<z.objectUtil.extendShape<{
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
}, {
    id: z.ZodString;
    pubkey: z.ZodString;
    sig: z.ZodString;
}>, "strict", z.ZodTypeAny, {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}, {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}>;
export type Event = z.infer<typeof baseEventSchema>;
export declare const tagsIncludingPlusCodeSchema: z.ZodEffects<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">, string[][], string[][]>;
export declare const contentSchema: z.ZodString;
