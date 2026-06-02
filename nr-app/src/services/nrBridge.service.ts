import { urlJoin } from "url-join-ts";

export type NrBridgeErrorCode =
  | "config"
  | "invalid-request"
  | "not-found"
  | "already-pending"
  | "invalid-or-expired"
  | "server"
  | "network";

type JsonBody = Record<string, unknown> | null;

const LOG_PREFIX = "[nr-app:nrBridge]";

export class NrBridgeError extends Error {
  status?: number;
  code: NrBridgeErrorCode;
  body: JsonBody;

  constructor({
    code,
    message,
    status,
    body = null,
  }: {
    code: NrBridgeErrorCode;
    message: string;
    status?: number;
    body?: JsonBody;
  }) {
    super(message);
    this.name = "NrBridgeError";
    this.code = code;
    this.status = status;
    this.body = body;
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
  console.log(`${LOG_PREFIX} resolving bridge base URL`, {
    nrBridgeBaseUrl: baseUrl,
    source: "process.env.EXPO_PUBLIC_NR_BRIDGE_BASE_URL",
  });

  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    console.log(`${LOG_PREFIX} missing bridge base URL`, { baseUrl });
    throw new NrBridgeError({
      code: "config",
      message: "nr-bridge base URL is not configured.",
    });
  }

  try {
    const normalizedBaseUrl = new URL(baseUrl.trim()).toString();
    console.log(`${LOG_PREFIX} resolved bridge base URL`, {
      normalizedBaseUrl,
    });
    return normalizedBaseUrl;
  } catch (error) {
    console.log(`${LOG_PREFIX} invalid bridge base URL`, { baseUrl, error });
    throw new NrBridgeError({
      code: "config",
      message: "nr-bridge base URL is invalid.",
    });
  }
}

function errorCodeForStatus(status: number): NrBridgeErrorCode {
  if (status === 400) return "invalid-request";
  if (status === 401) return "invalid-or-expired";
  if (status === 404) return "not-found";
  if (status === 409) return "already-pending";
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
  console.log(`${LOG_PREFIX} POST start`, {
    path,
    url,
    username: body.username,
    bodyKeys: Object.keys(body),
    hasCode: typeof body.code === "string",
    hasToken: typeof body.token === "string",
    hasNpub: typeof body.npub === "string",
  });

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
    if (error instanceof NrBridgeError) {
      console.log(`${LOG_PREFIX} POST failed with bridge error before fetch`, {
        path,
        code: error.code,
        status: error.status,
        message: error.message,
      });
      throw error;
    }

    console.log(`${LOG_PREFIX} POST network failure`, { path, url, error });
    throw new NrBridgeError({
      code: "network",
      message: "Could not reach nr-bridge.",
      body: error instanceof Error ? { message: error.message } : null,
    });
  }

  const parsedBody = await parseJson(response);
  console.log(`${LOG_PREFIX} POST response`, {
    path,
    status: response.status,
    ok: response.ok,
    body: parsedBody,
  });

  if (!response.ok) {
    throw new NrBridgeError({
      code: errorCodeForStatus(response.status),
      status: response.status,
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
