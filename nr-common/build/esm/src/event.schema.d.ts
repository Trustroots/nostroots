import { z } from "../deps.js";
export declare const kindSpecificEventSchema: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
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
}>, z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
}, {
    kind: z.ZodLiteral<10395>;
    content: z.ZodString;
}>, {
    id: z.ZodString;
    pubkey: z.ZodString;
    sig: z.ZodString;
}>, "strip", z.ZodTypeAny, {
    kind: 10395;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}, {
    kind: 10395;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}>, z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
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
}>, z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
}, {
    id: z.ZodString;
    pubkey: z.ZodString;
    sig: z.ZodString;
}>, {
    kind: z.ZodLiteral<30398>;
    tags: z.ZodEffects<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">, string[][], string[][]>;
    content: z.ZodString;
}>, "strict", z.ZodTypeAny, {
    kind: 30398;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}, {
    kind: 30398;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}>]>;
export declare const eventSchema: z.ZodUnion<[z.ZodDiscriminatedUnion<"kind", [z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
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
}>, z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
}, {
    kind: z.ZodLiteral<10395>;
    content: z.ZodString;
}>, {
    id: z.ZodString;
    pubkey: z.ZodString;
    sig: z.ZodString;
}>, "strip", z.ZodTypeAny, {
    kind: 10395;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}, {
    kind: 10395;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}>, z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
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
}>, z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
}, {
    id: z.ZodString;
    pubkey: z.ZodString;
    sig: z.ZodString;
}>, {
    kind: z.ZodLiteral<30398>;
    tags: z.ZodEffects<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">, string[][], string[][]>;
    content: z.ZodString;
}>, "strict", z.ZodTypeAny, {
    kind: 30398;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}, {
    kind: 30398;
    created_at: number;
    tags: string[][];
    content: string;
    id: string;
    pubkey: string;
    sig: string;
}>]>, z.ZodObject<z.objectUtil.extendShape<{
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
}>]>;
