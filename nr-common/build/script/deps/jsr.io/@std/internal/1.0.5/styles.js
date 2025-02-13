"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
// A module to print ANSI terminal colors. Inspired by chalk, kleur, and colors
// on npm.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bold = bold;
exports.red = red;
exports.green = green;
exports.yellow = yellow;
exports.white = white;
exports.gray = gray;
exports.brightBlack = brightBlack;
exports.bgRed = bgRed;
exports.bgGreen = bgGreen;
exports.stripAnsiCode = stripAnsiCode;
// This code is vendored from `fmt/colors.ts`.
// deno-lint-ignore no-explicit-any
const dntShim = __importStar(require("../../../../../_dnt.test_shims.js"));
const { Deno } = dntShim.dntGlobalThis;
const noColor = typeof Deno?.noColor === "boolean"
    ? Deno.noColor
    : false;
const enabled = !noColor;
function code(open, close) {
    return {
        open: `\x1b[${open.join(";")}m`,
        close: `\x1b[${close}m`,
        regexp: new RegExp(`\\x1b\\[${close}m`, "g"),
    };
}
function run(str, code) {
    return enabled
        ? `${code.open}${str.replace(code.regexp, code.open)}${code.close}`
        : str;
}
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
function bold(str) {
    return run(str, code([1], 22));
}
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
function red(str) {
    return run(str, code([31], 39));
}
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
function green(str) {
    return run(str, code([32], 39));
}
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
function yellow(str) {
    return run(str, code([33], 39));
}
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
function white(str) {
    return run(str, code([37], 39));
}
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
function gray(str) {
    return brightBlack(str);
}
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
function brightBlack(str) {
    return run(str, code([90], 39));
}
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
function bgRed(str) {
    return run(str, code([41], 49));
}
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
function bgGreen(str) {
    return run(str, code([42], 49));
}
// https://github.com/chalk/ansi-regex/blob/02fa893d619d3da85411acc8fd4e2eea0e95a9d9/index.js
const ANSI_PATTERN = new RegExp([
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TXZcf-nq-uy=><~]))",
].join("|"), "g");
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
function stripAnsiCode(string) {
    return string.replace(ANSI_PATTERN, "");
}
