// Copyright 2018-2025 the Deno authors. MIT license.
// deno-lint-ignore-file
import * as dntShim from "../../../../../_dnt.test_shims.js";


export function inspectArgs(args: unknown[]): string {
  return args.map(inspectArg).join(", ");
}

export function inspectArg(arg: unknown): string {
  const { Deno } = dntShim.dntGlobalThis as any;
  return typeof Deno !== "undefined" && Deno.inspect
    ? Deno.inspect(arg)
    : String(arg);
}
