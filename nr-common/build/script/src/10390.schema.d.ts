import { z } from "../deps.js";
export declare const kind10390EventSchema: z.ZodObject<z.objectUtil.extendShape<{
    id: z.ZodString;
    pubkey: z.ZodString;
    kind: z.ZodNumber;
    created_at: z.ZodNumber;
    tags: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    content: z.ZodString;
    sig: z.ZodString;
}, {
    kind: z.ZodLiteral<10390>;
    tags: z.ZodEffects<z.ZodEffects<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">, string[][], string[][]>, string[][], string[][]>;
}>, "strict", z.ZodTypeAny, {
    id: string;
    pubkey: string;
    kind: 10390;
    created_at: number;
    tags: string[][];
    content: string;
    sig: string;
}, {
    id: string;
    pubkey: string;
    kind: 10390;
    created_at: number;
    tags: string[][];
    content: string;
    sig: string;
}>;
//# sourceMappingURL=10390.schema.d.ts.map