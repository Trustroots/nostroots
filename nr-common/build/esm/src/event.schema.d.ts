export declare const eventSchema: import("zod").ZodEffects<import("zod").ZodObject<import("zod").objectUtil.extendShape<{
    kind: import("zod").ZodNumber;
    created_at: import("zod").ZodNumber;
    tags: import("zod").ZodArray<import("zod").ZodArray<import("zod").ZodString, "many">, "many">;
    content: import("zod").ZodString;
}, {
    id: import("zod").ZodString;
    pubkey: import("zod").ZodString;
    sig: import("zod").ZodString;
}>, "strict", import("zod").ZodTypeAny, {
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
}>, {
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
