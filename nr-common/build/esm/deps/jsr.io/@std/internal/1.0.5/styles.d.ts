/**
 * Sets the style of text to be printed to bold.
 *
 * Disable by setting the `NO_COLOR` environmental variable.
 *
 * @param str Text to make bold
 *
 * @returns Bold text for printing
 *
 * @example Usage
 * ```ts no-assert
 * import { bold } from "@std/internal/styles";
 *
 * console.log(bold("Hello, world!")); // Prints "Hello, world!" in bold
 * ```
 */
export declare function bold(str: string): string;
/**
 * Sets the color of text to be printed to red.
 *
 * Disable by setting the `NO_COLOR` environmental variable.
 *
 * @param str Text to make red
 *
 * @returns Red text for printing
 *
 * @example Usage
 * ```ts no-assert
 * import { red } from "@std/internal/styles";
 *
 * console.log(red("Hello, world!")); // Prints "Hello, world!" in red
 * ```
 */
export declare function red(str: string): string;
/**
 * Sets the color of text to be printed to green.
 *
 * Disable by setting the `NO_COLOR` environmental variable.
 *
 * @param str Text to make green
 *
 * @returns Green text for print
 *
 * @example Usage
 * ```ts no-assert
 * import { green } from "@std/internal/styles";
 *
 * console.log(green("Hello, world!")); // Prints "Hello, world!" in green
 * ```
 */
export declare function green(str: string): string;
/**
 * Sets the color of text to be printed to yellow.
 *
 * Disable by setting the `NO_COLOR` environmental variable.
 *
 * @param str Text to make yellow
 *
 * @returns Yellow text for print
 *
 * @example Usage
 * ```ts no-assert
 * import { yellow } from "@std/internal/styles";
 *
 * console.log(yellow("Hello, world!")); // Prints "Hello, world!" in yellow
 * ```
 */
export declare function yellow(str: string): string;
/**
 * Sets the color of text to be printed to white.
 *
 * @param str Text to make white
 *
 * @returns White text for print
 *
 * @example Usage
 * ```ts no-assert
 * import { white } from "@std/internal/styles";
 *
 * console.log(white("Hello, world!")); // Prints "Hello, world!" in white
 * ```
 */
export declare function white(str: string): string;
/**
 * Sets the color of text to be printed to gray.
 *
 * @param str Text to make gray
 *
 * @returns Gray text for print
 *
 * @example Usage
 * ```ts no-assert
 * import { gray } from "@std/internal/styles";
 *
 * console.log(gray("Hello, world!")); // Prints "Hello, world!" in gray
 * ```
 */
export declare function gray(str: string): string;
/**
 * Sets the color of text to be printed to bright-black.
 *
 * @param str Text to make bright-black
 *
 * @returns Bright-black text for print
 *
 * @example Usage
 * ```ts no-assert
 * import { brightBlack } from "@std/internal/styles";
 *
 * console.log(brightBlack("Hello, world!")); // Prints "Hello, world!" in bright-black
 * ```
 */
export declare function brightBlack(str: string): string;
/**
 * Sets the background color of text to be printed to red.
 *
 * @param str Text to make its background red
 *
 * @returns Red background text for print
 *
 * @example Usage
 * ```ts no-assert
 * import { bgRed } from "@std/internal/styles";
 *
 * console.log(bgRed("Hello, world!")); // Prints "Hello, world!" with red background
 * ```
 */
export declare function bgRed(str: string): string;
/**
 * Sets the background color of text to be printed to green.
 *
 * @param str Text to make its background green
 *
 * @returns Green background text for print
 *
 * @example Usage
 * ```ts no-assert
 * import { bgGreen } from "@std/internal/styles";
 *
 * console.log(bgGreen("Hello, world!")); // Prints "Hello, world!" with green background
 * ```
 */
export declare function bgGreen(str: string): string;
/**
 * Remove ANSI escape codes from the string.
 *
 * @param string Text to remove ANSI escape codes from
 *
 * @returns Text without ANSI escape codes
 *
 * @example Usage
 * ```ts no-assert
 * import { red, stripAnsiCode } from "@std/internal/styles";
 *
 * console.log(stripAnsiCode(red("Hello, world!"))); // Prints "Hello, world!"
 * ```
 */
export declare function stripAnsiCode(string: string): string;
//# sourceMappingURL=styles.d.ts.map