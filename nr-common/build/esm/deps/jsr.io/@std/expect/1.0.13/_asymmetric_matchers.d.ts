export declare abstract class AsymmetricMatcher<T> {
    protected value: T;
    protected inverse: boolean;
    constructor(value: T, inverse?: boolean);
    abstract equals(other: unknown): boolean;
}
export declare class Anything extends AsymmetricMatcher<void> {
    equals(other: unknown): boolean;
}
export declare function anything(): Anything;
export declare class Any extends AsymmetricMatcher<any> {
    constructor(value: unknown);
    equals(other: unknown): boolean;
}
export declare function any(c: unknown): Any;
export declare class ArrayContaining extends AsymmetricMatcher<any[]> {
    constructor(arr: any[], inverse?: boolean);
    equals(other: any[]): boolean;
}
export declare function arrayContaining(c: any[]): ArrayContaining;
export declare function arrayNotContaining(c: any[]): ArrayContaining;
export declare class CloseTo extends AsymmetricMatcher<number> {
    #private;
    constructor(num: number, precision?: number);
    equals(other: number): boolean;
}
export declare function closeTo(num: number, numDigits?: number): CloseTo;
export declare class StringContaining extends AsymmetricMatcher<string> {
    constructor(str: string, inverse?: boolean);
    equals(other: string): boolean;
}
export declare function stringContaining(str: string): StringContaining;
export declare function stringNotContaining(str: string): StringContaining;
export declare class StringMatching extends AsymmetricMatcher<RegExp> {
    constructor(pattern: string | RegExp, inverse?: boolean);
    equals(other: string): boolean;
}
export declare function stringMatching(pattern: string | RegExp): StringMatching;
export declare function stringNotMatching(pattern: string | RegExp): StringMatching;
export declare class ObjectContaining extends AsymmetricMatcher<Record<string, unknown>> {
    constructor(obj: Record<string, unknown>, inverse?: boolean);
    equals(other: Record<string, unknown>): boolean;
}
export declare function objectContaining(obj: Record<string, unknown>): ObjectContaining;
export declare function objectNotContaining(obj: Record<string, unknown>): ObjectContaining;
//# sourceMappingURL=_asymmetric_matchers.d.ts.map