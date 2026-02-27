import { expect } from "jsr:@std/expect";
import { generateSixDigitCode, generateToken } from "../../src/utils.ts";

Deno.test("#br1dge generateSixDigitCode returns a 6-digit numeric string", () => {
  const code = generateSixDigitCode();
  expect(code).toMatch(/^\d{6}$/);
});

Deno.test("#br2dge generateSixDigitCode never starts with 0", () => {
  for (let i = 0; i < 100; i++) {
    const code = generateSixDigitCode();
    const num = parseInt(code, 10);
    expect(num).toBeGreaterThanOrEqual(100000);
    expect(num).toBeLessThanOrEqual(999999);
  }
});

Deno.test("#br3dge generateSixDigitCode produces varying codes", () => {
  const codes = new Set<string>();
  for (let i = 0; i < 20; i++) {
    codes.add(generateSixDigitCode());
  }
  expect(codes.size).toBeGreaterThan(1);
});

Deno.test("#br4dge generateToken returns a valid UUID v4", () => {
  const token = generateToken();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  expect(token).toMatch(uuidRegex);
});

Deno.test("#br5dge generateToken produces unique tokens", () => {
  const a = generateToken();
  const b = generateToken();
  expect(a).not.toBe(b);
});
