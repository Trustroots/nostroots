/** Any constructor */
export type AnyConstructor = new (...args: any[]) => any;
/** Gets constructor type */
export type GetConstructorType<T extends AnyConstructor> = InstanceType<T>;
/**
 * Make an assertion that `obj` is an instance of `type`.
 * If not then throw.
 *
 * @example Usage
 * ```ts ignore
 * import { assertInstanceOf } from "@std/assert";
 *
 * assertInstanceOf(new Date(), Date); // Doesn't throw
 * assertInstanceOf(new Date(), Number); // Throws
 * ```
 *
 * @typeParam T The expected type of the object.
 * @param actual The object to check.
 * @param expectedType The expected class constructor.
 * @param msg The optional message to display if the assertion fails.
 */
export declare function assertInstanceOf<T extends abstract new (...args: any[]) => any>(actual: unknown, expectedType: T, msg?: string): asserts actual is InstanceType<T>;
//# sourceMappingURL=instance_of.d.ts.map