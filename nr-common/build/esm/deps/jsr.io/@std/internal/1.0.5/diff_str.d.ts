import type { DiffResult } from "./types.js";
/**
 * Unescape invisible characters.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#escape_sequences}
 *
 * @param string String to unescape.
 *
 * @returns Unescaped string.
 *
 * @example Usage
 * ```ts
 * import { unescape } from "@std/internal/diff-str";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(unescape("Hello\nWorld"), "Hello\\n\nWorld");
 * ```
 */
export declare function unescape(string: string): string;
/**
 * Tokenizes a string into an array of tokens.
 *
 * @param string The string to tokenize.
 * @param wordDiff If true, performs word-based tokenization. Default is false.
 *
 * @returns An array of tokens.
 *
 * @example Usage
 * ```ts
 * import { tokenize } from "@std/internal/diff-str";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(tokenize("Hello\nWorld"), ["Hello\n", "World"]);
 * ```
 */
export declare function tokenize(string: string, wordDiff?: boolean): string[];
/**
 * Create details by filtering relevant word-diff for current line and merge
 * "space-diff" if surrounded by word-diff for cleaner displays.
 *
 * @param line Current line
 * @param tokens Word-diff tokens
 *
 * @returns Array of diff results.
 *
 * @example Usage
 * ```ts
 * import { createDetails } from "@std/internal/diff-str";
 * import { assertEquals } from "@std/assert";
 *
 * const tokens = [
 *   { type: "added", value: "a" },
 *   { type: "removed", value: "b" },
 *   { type: "common", value: "c" },
 * ] as const;
 * assertEquals(
 *   createDetails({ type: "added", value: "a" }, [...tokens]),
 *   [{ type: "added", value: "a" }, { type: "common", value: "c" }]
 * );
 * ```
 */
export declare function createDetails(line: DiffResult<string>, tokens: DiffResult<string>[]): DiffResult<string>[];
/**
 * Renders the differences between the actual and expected strings. Partially
 * inspired from {@link https://github.com/kpdecker/jsdiff}.
 *
 * @param A Actual string
 * @param B Expected string
 *
 * @returns Array of diff results.
 *
 * @example Usage
 * ```ts
 * import { diffStr } from "@std/internal/diff-str";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(diffStr("Hello!", "Hello"), [
 *   {
 *     type: "removed",
 *     value: "Hello!\n",
 *     details: [
 *       { type: "common", value: "Hello" },
 *       { type: "removed", value: "!" },
 *       { type: "common", value: "\n" }
 *     ]
 *   },
 *   {
 *     type: "added",
 *     value: "Hello\n",
 *     details: [
 *       { type: "common", value: "Hello" },
 *       { type: "common", value: "\n" }
 *     ]
 *   }
 * ]);
 * ```
 */
export declare function diffStr(A: string, B: string): DiffResult<string>[];
//# sourceMappingURL=diff_str.d.ts.map