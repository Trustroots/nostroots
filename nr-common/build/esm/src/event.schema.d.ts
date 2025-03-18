export declare const eventSchema: import("zod").ZodEffects<import("zod").ZodObject<{
    id: import("zod").ZodString;
    pubkey: import("zod").ZodString;
    kind: import("zod").ZodNumber;
    created_at: import("zod").ZodNumber;
    tags: import("zod").ZodArray<import("zod").ZodArray<import("zod").ZodString, "many">, "many">;
    content: import("zod").ZodString;
    sig: import("zod").ZodString;
}, "strict", import("zod").ZodTypeAny, {
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
}>, {
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
//# sourceMappingURL=event.schema.d.ts.map