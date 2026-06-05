import type { NostrEvent } from "nostr-tools";
import type { APNSConfig } from "./config.ts";
import type { APNSToken } from "./schema.ts";
import { plusCodeFromEvent } from "./schema.ts";
import { log } from "./log.ts";

function truncateContent(s: string, max: number): string {
  const runes = [...s];
  if (runes.length <= max) return s;
  return runes.slice(0, max).join("") + "...";
}

function apnsHost(environment: APNSConfig["environment"]): string {
  return environment === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64Url(data: Uint8Array | ArrayBuffer | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function createAPNSJwt(config: APNSConfig, issuedAt = Math.floor(Date.now() / 1000)): Promise<string> {
  const header = { alg: "ES256", kid: config.keyId };
  const claims = { iss: config.teamId, iat: issuedAt };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(config.privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64Url(signature)}`;
}

export function createAPNSPayload(event: NostrEvent, username?: string): Record<string, unknown> {
  const plusCode = plusCodeFromEvent(event) ?? "";
  return {
    aps: {
      alert: {
        title: `${username ?? "Somebody"} posted on the map`,
        body: truncateContent(event.content, 80),
      },
      sound: "default",
    },
    type: "eventJSON",
    event: JSON.stringify(event),
    plusCode,
  };
}

export async function sendAPNSNotification(
  token: APNSToken,
  event: NostrEvent,
  config: APNSConfig,
  username?: string,
): Promise<void> {
  if (token.topic !== config.topic || token.environment !== config.environment) {
    log.debug(`Skipping APNs token for ${token.topic}/${token.environment}; daemon is ${config.topic}/${config.environment}`);
    return;
  }

  const jwt = await createAPNSJwt(config);
  const response = await fetch(`${apnsHost(config.environment)}/3/device/${token.token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": config.topic,
      "apns-push-type": "alert",
      "content-type": "application/json",
    },
    body: JSON.stringify(createAPNSPayload(event, username)),
  });

  if (!response.ok) {
    log.error(`APNs error ${response.status} ${response.statusText}: ${await response.text()}`);
    return;
  }
  log.info(`Sent APNs notification to ${token.token.slice(0, 12)}...`);
}
