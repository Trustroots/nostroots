import { z } from './deps.js';
export declare const CONTENT_MINIMUM_LENGTH = 3;
export declare const CONTENT_MAXIMUM_LENGTH = 300;
export * from './constants.js';
export * from './utils.js';
export declare const eventSchema: z.ZodObject<{
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
export type Event = z.infer<typeof eventSchema>;
export declare const tagsIncludingPlusCodeSchema: z.ZodEffects<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">, string[][], string[][]>;
export declare const contentSchema: z.ZodString;
export declare const kind30398EventSchema: z.ZodObject<z.objectUtil.extendShape<{
    id: z.ZodString;
    pubkey: z.ZodString;
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
    sig: z.ZodString;
}, {
    kind: z.ZodLiteral<30398>;
    tags: z.ZodEffects<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">, string[][], string[][]>;
    content: z.ZodString;
}>, "strict", z.ZodTypeAny, {
    id: string;
    pubkey: string;
    kind: 30398;
    created_at: number;
    tags: string[][];
    content: string;
    sig: string;
}, {
    id: string;
    pubkey: string;
    kind: 30398;
    created_at: number;
    tags: string[][];
    content: string;
    sig: string;
}>;
export type Kind30398Event = z.infer<typeof kind30398EventSchema>;
export declare const kind30397EventSchema: z.ZodObject<z.objectUtil.extendShape<{
    id: z.ZodString;
    pubkey: z.ZodString;
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
    sig: z.ZodString;
}, {
    kind: z.ZodLiteral<30397>;
    tags: z.ZodEffects<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">, string[][], string[][]>;
    content: z.ZodString;
}>, "strict", z.ZodTypeAny, {
    id: string;
    pubkey: string;
    kind: 30397;
    created_at: number;
    tags: string[][];
    content: string;
    sig: string;
}, {
    id: string;
    pubkey: string;
    kind: 30397;
    created_at: number;
    tags: string[][];
    content: string;
    sig: string;
}>;
export declare function isValidEvent(event: Event): boolean;
//# sourceMappingURL=mod.d.ts.map