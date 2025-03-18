import type { EqualOptions } from "./_types.js";
type EqualErrorMessageOptions = Pick<EqualOptions, "formatter" | "msg">;
export declare function buildEqualErrorMessage<T>(actual: T, expected: T, options: EqualErrorMessageOptions): string;
export declare function buildNotEqualErrorMessage<T>(actual: T, expected: T, options: EqualErrorMessageOptions): string;
export {};
//# sourceMappingURL=_build_message.d.ts.map