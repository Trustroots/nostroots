import { z } from "../deps.js";
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
//# sourceMappingURL=30398.schema.d.ts.map