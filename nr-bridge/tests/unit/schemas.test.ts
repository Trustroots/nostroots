import { expect } from "jsr:@std/expect";
import {
  RequestTokenBodySchema,
  VerifyCodeBodySchema,
} from "@trustroots/nr-common";
import { PendingVerificationSchema } from "../../schemas/pendingVerification.ts";

Deno.test("#sch1 RequestTokenBodySchema accepts valid username", () => {
  const result = RequestTokenBodySchema.safeParse({ username: "alice" });
  expect(result.success).toBe(true);
});

Deno.test("#sch2 RequestTokenBodySchema rejects empty username", () => {
  const result = RequestTokenBodySchema.safeParse({ username: "" });
  expect(result.success).toBe(false);
});

Deno.test("#sch3 RequestTokenBodySchema rejects missing username", () => {
  const result = RequestTokenBodySchema.safeParse({});
  expect(result.success).toBe(false);
});

Deno.test("#sch4 VerifyCodeBodySchema accepts valid token, code, npub", () => {
  const result = VerifyCodeBodySchema.safeParse({
    npub: "npub1abc123",
    token: "550e8400-e29b-41d4-a716-446655440000",
    code: "123456",
  });
  expect(result.success).toBe(true);
});

Deno.test("#sch5 VerifyCodeBodySchema rejects missing code", () => {
  const result = VerifyCodeBodySchema.safeParse({
    npub: "npub1abc123",
    token: "550e8400-e29b-41d4-a716-446655440000",
  });
  expect(result.success).toBe(false);
});

Deno.test("#sch6 VerifyCodeBodySchema rejects missing token", () => {
  const result = VerifyCodeBodySchema.safeParse({
    npub: "npub1abc123",
    code: "123456",
  });
  expect(result.success).toBe(false);
});

Deno.test("#sch7 VerifyCodeBodySchema rejects invalid npub", () => {
  const result = VerifyCodeBodySchema.safeParse({
    npub: "nsec1secret",
    token: "550e8400-e29b-41d4-a716-446655440000",
    code: "123456",
  });
  expect(result.success).toBe(false);
});

Deno.test("#sch8 VerifyCodeBodySchema rejects invalid code format", () => {
  const result = VerifyCodeBodySchema.safeParse({
    npub: "npub1abc123",
    token: "550e8400-e29b-41d4-a716-446655440000",
    code: "12345",
  });
  expect(result.success).toBe(false);
});

Deno.test("#sch9 PendingVerificationSchema validates a full record", () => {
  const now = Date.now();
  const result = PendingVerificationSchema.safeParse({
    id: "550e8400-e29b-41d4-a716-446655440000",
    username: "alice",
    email: "alice@example.com",
    token: "660e8400-e29b-41d4-a716-446655440000",
    code: "123456",
    createdAt: now,
    expiresAt: now + 900000,
  });
  expect(result.success).toBe(true);
});
