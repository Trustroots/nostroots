import { z } from "../deps.js";
import { baseEventTemplateSchema } from "./base.schema.js";
/**
 * A kind 10390 event is a trustroots profile on nostr.
 *
 * So it's a nostr event, inspired by kind 0, that stores the trustroots
 * username as a tag value.
 */
export declare const kind10390EventTemplateSchema: z.ZodObject<z.objectUtil.extendShape<{
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
}, {
    kind: z.ZodLiteral<10390>;
    tags: z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">, string[][], string[][]>, string[][], string[][]>;
}>, "strip", z.ZodTypeAny, {
    kind: 10390;
    created_at: number;
    tags: string[][];
    content: string;
}, {
    kind: 10390;
    created_at: number;
    tags: string[][];
    content: string;
}>;
export type Kind10390EventTemplate = z.infer<typeof baseEventTemplateSchema>;
export declare const kind10390EventSchema: z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
}, {
    kind: z.ZodLiteral<10390>;
    tags: z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">, string[][], string[][]>, string[][], string[][]>;
}>, {
    id: z.ZodString;
    pubkey: z.ZodString;
    sig: z.ZodString;
}>, "strip", z.ZodTypeAny, {
    kind: 10390;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}, {
    kind: 10390;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}>;
export type Kind10390Event = z.infer<typeof kind10390EventSchema>;
export declare function createKind10390EventTemplate(trustrootsUsername: string): {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
};
