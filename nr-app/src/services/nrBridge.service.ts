import { urlJoin } from "url-join-ts";

export type NrBridgeErrorCode =
  | "config"
  | "invalid-request"
  | "not-found"
  | "already-pending"
  | "rate-limited"
  | "wrong-code"
  | "invalid-or-expired"
  | "server"
  | "network";

type JsonBody = Record<string, unknown> | null;

export class NrBridgeError extends Error {
  status?: number;
  code: NrBridgeErrorCode;
  body: JsonBody;
  attemptsLeft?: number;

  constructor({
    code,
    message,
    status,
    body = null,
    attemptsLeft,
  }: {
    code: NrBridgeErrorCode;
    message: string;
    status?: number;
    body?: JsonBody;
    attemptsLeft?: number;
  }) {
    super(message);
    this.name = "NrBridgeError";
    this.code = code;
    this.status = status;
    this.body = body;
    this.attemptsLeft = attemptsLeft;
  }
}

export type AuthenticateWithCodeInput = {
  username: string;
  npub: string;
  code: string;
};

export type AuthenticateWithTokenInput = {
  username: string;
  npub: string;
  token: string;
};

function getBridgeBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_NR_BRIDGE_BASE_URL;

  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    throw new NrBridgeError({
      code: "config",
      message: "nr-bridge base URL is not configured.",
    });
  }

  try {
    const normalizedBaseUrl = new URL(baseUrl.trim()).toString();
    return normalizedBaseUrl;
  } catch {
    throw new NrBridgeError({
      code: "config",
      message: "nr-bridge base URL is invalid.",
    });
  }
}

const WRONG_CODE_MESSAGE = "Invalid code or token";

function errorCodeForResponse(
  status: number,
  body: JsonBody,
  attemptsLeft: number | undefined,
): NrBridgeErrorCode {
  if (status === 400) return "invalid-request";
  if (status === 401) {
    // Older bridges send no reason, only the message.
    const isWrongCode =
      body?.reason === "wrong-code" ||
      (body?.reason === undefined && body?.error === WRONG_CODE_MESSAGE);
    return isWrongCode && attemptsLeft !== 0
      ? "wrong-code"
      : "invalid-or-expired";
  }
  if (status === 404) return "not-found";
  if (status === 409) return "already-pending";
  if (status === 429) return "rate-limited";
  return "server";
}

async function parseJson(response: Response): Promise<JsonBody> {
  try {
    const parsed = await response.json();
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function postJson(path: string, body: Record<string, unknown>) {
  const url = urlJoin(getBridgeBaseUrl(), path);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new NrBridgeError({
      code: "network",
      message: "Could not reach nr-bridge.",
      body: error instanceof Error ? { message: error.message } : null,
    });
  }

  const parsedBody = await parseJson(response);

  if (!response.ok) {
    const attemptsLeft =
      typeof parsedBody?.attemptsLeft === "number"
        ? parsedBody.attemptsLeft
        : undefined;
    throw new NrBridgeError({
      code: errorCodeForResponse(response.status, parsedBody, attemptsLeft),
      status: response.status,
      attemptsLeft,
      message:
        typeof parsedBody?.error === "string"
          ? parsedBody.error
          : "nr-bridge request failed.",
      body: parsedBody,
    });
  }

  return parsedBody;
}

export async function requestVerificationToken(username: string) {
  await postJson("/verify_token", { username });
}

export async function authenticateWithCode(input: AuthenticateWithCodeInput) {
  await postJson("/authenticate", input);
}

export async function authenticateWithToken(input: AuthenticateWithTokenInput) {
  await postJson("/authenticate", input);
}
