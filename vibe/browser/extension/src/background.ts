import type { EventTemplate } from "nostr-tools";

import {
  EXTENSION_BRAND,
  MESSAGE_SOURCE_CONTENT,
  MESSAGE_SOURCE_PROMPT,
  isKnownNip07Method,
  nip07MethodLabel,
  type Nip07Method,
} from "./shared/constants";
import { extensionApi } from "./shared/extension-api";
import { failure, success, type BridgeResponse, type ContentRequest } from "./shared/messages";
import {
  nip04Decrypt,
  nip04Encrypt,
  nip44Decrypt,
  nip44Encrypt,
  signNostrEvent,
} from "./shared/nostr";
import { isExtensionAllowedPageOrigin, normalizeOrigin } from "./shared/origins";
import { permissionDecisionForOrigin, rememberOriginIfRequested } from "./shared/permissions";
import { publicKeyFromPrivateKey } from "./shared/keys";
import { readPrivateKeyHex } from "./shared/storage";

type PromptDecision = "allow_once" | "always_allow_method" | "always_allow_all" | "deny";

type PromptRequest = {
  source: typeof MESSAGE_SOURCE_PROMPT;
  promptId: string;
  decision: PromptDecision;
};

type PendingPrompt = {
  promptId: string;
  origin: string;
  methods: Set<Nip07Method>;
  preview: string;
  resolves: Array<(decision: PromptDecision) => void>;
  windowId?: number;
};

const pendingPromptsById = new Map<string, PendingPrompt>();
const pendingPromptsByOrigin = new Map<string, PendingPrompt>();

extensionApi.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    extensionApi.runtime.openOptionsPage();
  }
});

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (isPromptRequest(message)) {
    void handlePromptResponse(message, sender).then(sendResponse);
    return true;
  }

  if (isContentRequest(message)) {
    void handleContentRequest(message).then(sendResponse);
    return true;
  }

  return false;
});

extensionApi.windows.onRemoved.addListener((windowId) => {
  for (const prompt of pendingPromptsById.values()) {
    if (prompt.windowId === windowId) {
      resolvePendingPrompt(prompt, "deny");
    }
  }
});

async function handleContentRequest(request: ContentRequest): Promise<BridgeResponse> {
  try {
    const origin = normalizeOrigin(request.origin);
    if (!origin || !isExtensionAllowedPageOrigin(origin)) {
      return failure(request.id, "This page cannot use Nostroots Extension.");
    }

    const privateKeyHex = await readPrivateKeyHex();
    if (!privateKeyHex) {
      return failure(request.id, `No key is stored in ${EXTENSION_BRAND}.`);
    }

    const permission = await permissionDecisionForOrigin(origin, request.method);
    if (permission === "blocked") {
      return failure(request.id, "This origin is not allowed to use Nostroots Extension.");
    }

    if (permission === "prompt") {
      const decision = await requestPermission(origin, request.method, request.params);
      if (decision === "deny") return failure(request.id, "Permission denied.");
      await rememberOriginIfRequested(origin, request.method, decision);
    }

    return success(request.id, await performOperation(privateKeyHex, request.method, request.params));
  } catch (error) {
    return failure(request.id, error);
  }
}

async function performOperation(privateKeyHex: string, method: string, params: unknown): Promise<unknown> {
  switch (method) {
    case "getPublicKey":
      return publicKeyFromPrivateKey(privateKeyHex);
    case "signEvent":
      return signNostrEvent(privateKeyHex, eventTemplateFromParams(params));
    case "nip44.encrypt": {
      const [peer, text] = peerTextParams(params);
      return nip44Encrypt(privateKeyHex, peer, text);
    }
    case "nip44.decrypt": {
      const [peer, text] = peerTextParams(params);
      return nip44Decrypt(privateKeyHex, peer, text);
    }
    case "nip04.encrypt": {
      const [peer, text] = peerTextParams(params);
      return nip04Encrypt(privateKeyHex, peer, text);
    }
    case "nip04.decrypt": {
      const [peer, text] = peerTextParams(params);
      return nip04Decrypt(privateKeyHex, peer, text);
    }
    default:
      throw new Error("Unknown NIP-07 method.");
  }
}

function eventTemplateFromParams(params: unknown): EventTemplate {
  if (!Array.isArray(params) || params.length !== 1 || !isRecord(params[0])) {
    throw new Error("Invalid signEvent parameters.");
  }

  const input = params[0];
  if (!Number.isInteger(input.kind)) throw new Error("Event kind must be an integer.");
  if (input.created_at !== undefined && !Number.isInteger(input.created_at)) {
    throw new Error("Event created_at must be an integer.");
  }
  if (input.tags !== undefined && !isStringTagArray(input.tags)) {
    throw new Error("Event tags must be string arrays.");
  }
  if (input.content !== undefined && typeof input.content !== "string") {
    throw new Error("Event content must be a string.");
  }

  const kind = input.kind as number;
  const createdAt = (input.created_at as number | undefined) ?? Math.floor(Date.now() / 1000);
  const tags = input.tags as string[][] | undefined;
  const content = input.content as string | undefined;

  return {
    kind,
    created_at: createdAt,
    tags: tags ?? [],
    content: content ?? "",
  };
}

function peerTextParams(params: unknown): [string, string] {
  if (
    !Array.isArray(params) ||
    params.length !== 2 ||
    typeof params[0] !== "string" ||
    typeof params[1] !== "string"
  ) {
    throw new Error("Expected peer public key and text parameters.");
  }
  return [params[0].toLowerCase(), params[1]];
}

async function requestPermission(origin: string, method: Nip07Method, params: unknown): Promise<PromptDecision> {
  const existing = pendingPromptsByOrigin.get(origin);
  if (existing) {
    existing.methods.add(method);
    return new Promise<PromptDecision>((resolve) => {
      existing.resolves.push(resolve);
      void notifyPromptUpdate(existing);
    });
  }

  const promptId = crypto.randomUUID();
  const preview = method === "signEvent" && Array.isArray(params) ? JSON.stringify(params[0], null, 2) : "";

  return new Promise<PromptDecision>((resolve) => {
    const prompt: PendingPrompt = {
      promptId,
      origin,
      methods: new Set([method]),
      preview,
      resolves: [resolve],
    };
    pendingPromptsById.set(promptId, prompt);
    pendingPromptsByOrigin.set(origin, prompt);

    void openPermissionPrompt(prompt, method, preview);
  });
}

async function openPermissionPrompt(prompt: PendingPrompt, method: Nip07Method, preview: string): Promise<void> {
  const position = await centeredPromptPosition(520, 580);
  const query = new URLSearchParams({
    promptId: prompt.promptId,
    origin: prompt.origin,
    method,
    methods: Array.from(prompt.methods).join(","),
    preview,
  });

  extensionApi.windows
    .create({
      url: extensionApi.runtime.getURL(`prompt.html?${query.toString()}`),
      type: "popup",
      width: 520,
      height: 580,
      left: position.left,
      top: position.top,
    })
    .then((createdWindow) => {
      const pendingPrompt = pendingPromptsById.get(prompt.promptId);
      if (pendingPrompt) {
        pendingPrompt.windowId = createdWindow.id;
        void notifyPromptUpdate(pendingPrompt);
      }
    })
    .catch(() => {
      resolvePendingPrompt(prompt, "deny");
    });
}

async function handlePromptResponse(request: PromptRequest, sender: chrome.runtime.MessageSender): Promise<boolean> {
  const pending = pendingPromptsById.get(request.promptId);
  if (!pending) return false;

  resolvePendingPrompt(pending, request.decision);

  const windowId = sender.tab?.windowId ?? pending.windowId;
  if (typeof windowId === "number") {
    await extensionApi.windows.remove(windowId).catch(() => undefined);
  }

  return true;
}

function resolvePendingPrompt(prompt: PendingPrompt, decision: PromptDecision): void {
  pendingPromptsById.delete(prompt.promptId);
  pendingPromptsByOrigin.delete(prompt.origin);
  for (const resolve of prompt.resolves.splice(0)) {
    resolve(decision);
  }
}

async function notifyPromptUpdate(prompt: PendingPrompt): Promise<void> {
  await extensionApi.runtime.sendMessage({
    source: MESSAGE_SOURCE_PROMPT,
    promptId: prompt.promptId,
    update: "methods",
    methods: Array.from(prompt.methods),
    methodLabels: Array.from(prompt.methods).map(nip07MethodLabel),
  }).catch(() => undefined);
}

async function centeredPromptPosition(width: number, height: number): Promise<{ left: number; top: number }> {
  try {
    const focused = await extensionApi.windows.getLastFocused();
    if (
      typeof focused.left === "number" &&
      typeof focused.top === "number" &&
      typeof focused.width === "number" &&
      typeof focused.height === "number"
    ) {
      return {
        left: Math.round(focused.left + (focused.width - width) / 2),
        top: Math.round(focused.top + (focused.height - height) / 2),
      };
    }
  } catch {
    // Fall back to the browser default position.
  }
  return { left: 0, top: 0 };
}

function isContentRequest(message: unknown): message is ContentRequest {
  return (
    isRecord(message) &&
    message.source === MESSAGE_SOURCE_CONTENT &&
    typeof message.id === "string" &&
    isKnownNip07Method(message.method) &&
    typeof message.origin === "string"
  );
}

function isPromptRequest(message: unknown): message is PromptRequest {
  return (
    isRecord(message) &&
    message.source === MESSAGE_SOURCE_PROMPT &&
    typeof message.promptId === "string" &&
    (message.decision === "allow_once" ||
      message.decision === "always_allow_method" ||
      message.decision === "always_allow_all" ||
      message.decision === "deny")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringTagArray(value: unknown): value is string[][] {
  return Array.isArray(value) && value.every((tag) => Array.isArray(tag) && tag.every((part) => typeof part === "string"));
}
