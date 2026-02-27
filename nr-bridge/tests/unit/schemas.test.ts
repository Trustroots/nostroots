import { expect } from "jsr:@std/expect";
import {
  VerifyTokenRequestSchema,
  AuthenticateRequestSchema,
  TokenRequestSchema,
} from "../../schemas/tokenRequest.ts";

Deno.test("#sch1 VerifyTokenRequestSchema accepts valid username", () => {
  const result = VerifyTokenRequestSchema.safeParse({ username: "alice" });
  expect(result.success).toBe(true);
});

Deno.test("#sch2 VerifyTokenRequestSchema rejects empty username", () => {
  const result = VerifyTokenRequestSchema.safeParse({ username: "" });
  expect(result.success).toBe(false);
});

Deno.test("#sch3 VerifyTokenRequestSchema rejects missing username", () => {
  const result = VerifyTokenRequestSchema.safeParse({});
  expect(result.success).toBe(false);
});

Deno.test("#sch4 AuthenticateRequestSchema accepts valid code request", () => {
  const result = AuthenticateRequestSchema.safeParse({
    username: "alice",
    npub: "npub1abc123",
    code: "123456",
  });
  expect(result.success).toBe(true);
});

Deno.test("#sch5 AuthenticateRequestSchema accepts valid token request", () => {
  const result = AuthenticateRequestSchema.safeParse({
    username: "alice",
    npub: "npub1abc123",
    token: "550e8400-e29b-41d4-a716-446655440000",
  });
  expect(result.success).toBe(true);
});

Deno.test("#sch6 AuthenticateRequestSchema rejects missing code and token", () => {
  const result = AuthenticateRequestSchema.safeParse({
    username: "alice",
    npub: "npub1abc123",
  });
  expect(result.success).toBe(false);
});

Deno.test("#sch7 AuthenticateRequestSchema rejects invalid npub", () => {
  const result = AuthenticateRequestSchema.safeParse({
    username: "alice",
    npub: "nsec1secret",
    code: "123456",
  });
  expect(result.success).toBe(false);
});

Deno.test("#sch8 AuthenticateRequestSchema rejects invalid code format", () => {
  const result = AuthenticateRequestSchema.safeParse({
    username: "alice",
    npub: "npub1abc123",
    code: "12345",
  });
  expect(result.success).toBe(false);
});

Deno.test("#sch9 TokenRequestSchema validates a full token request", () => {
  const now = Date.now();
  const result = TokenRequestSchema.safeParse({
    id: "550e8400-e29b-41d4-a716-446655440000",
    username: "alice",
    email: "alice@example.com",
    code: "123456",
    token: "660e8400-e29b-41d4-a716-446655440000",
    createdAt: now,
    expiresAt: now + 900000,
  });
  expect(result.success).toBe(true);
});
