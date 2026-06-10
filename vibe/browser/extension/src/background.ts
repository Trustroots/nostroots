import type { EventTemplate } from "nostr-tools";

import {
  EXTENSION_BRAND,
  MESSAGE_SOURCE_CONTENT,
  MESSAGE_SOURCE_PROMPT,
  isKnownNip07Method,
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

type PromptDecision = "allow_once" | "always_allow" | "deny";

type PromptRequest = {
  source: typeof MESSAGE_SOURCE_PROMPT;
  promptId: string;
  decision: PromptDecision;
};

type PendingPrompt = {
  origin: string;
  method: string;
  resolve: (decision: PromptDecision) => void;
  windowId?: number;
};

const pendingPrompts = new Map<string, PendingPrompt>();

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
  for (const [promptId, prompt] of pendingPrompts) {
    if (prompt.windowId === windowId) {
      pendingPrompts.delete(promptId);
      prompt.resolve("deny");
    }
  }
});

async function handleContentRequest(request: ContentRequest): Promise<BridgeResponse> {
  try {
    const origin = normalizeOrigin(request.origin);
    if (!origin || !isExtensionAllowedPageOrigin(origin)) {
      return failure(request.id, "This page cannot use Nostroots Browser Extension.");
    }

    const privateKeyHex = await readPrivateKeyHex();
    if (!privateKeyHex) {
      return failure(request.id, `No key is stored in ${EXTENSION_BRAND}.`);
    }

    const permission = await permissionDecisionForOrigin(origin);
    if (permission === "blocked") {
      return failure(request.id, "This origin is not allowed to use Nostroots Browser Extension.");
    }

    if (permission === "prompt") {
      const decision = await requestPermission(origin, request.method, request.params);
      if (decision === "deny") return failure(request.id, "Permission denied.");
      await rememberOriginIfRequested(origin, decision === "always_allow");
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

async function requestPermission(origin: string, method: string, params: unknown): Promise<PromptDecision> {
  const promptId = crypto.randomUUID();
  const position = await centeredPromptPosition(460, 460);
  const preview = method === "signEvent" && Array.isArray(params) ? JSON.stringify(params[0], null, 2) : "";
  const query = new URLSearchParams({
    promptId,
    origin,
    method,
    preview,
  });

  return new Promise<PromptDecision>((resolve) => {
    pendingPrompts.set(promptId, { origin, method, resolve });

    extensionApi.windows
      .create({
        url: extensionApi.runtime.getURL(`prompt.html?${query.toString()}`),
        type: "popup",
        width: 460,
        height: 460,
        left: position.left,
        top: position.top,
      })
      .then((createdWindow) => {
        const prompt = pendingPrompts.get(promptId);
        if (prompt) prompt.windowId = createdWindow.id;
      })
      .catch(() => {
        pendingPrompts.delete(promptId);
        resolve("deny");
      });
  });
}

async function handlePromptResponse(request: PromptRequest, sender: chrome.runtime.MessageSender): Promise<boolean> {
  const pending = pendingPrompts.get(request.promptId);
  if (!pending) return false;

  pendingPrompts.delete(request.promptId);
  pending.resolve(request.decision);

  const windowId = sender.tab?.windowId ?? pending.windowId;
  if (typeof windowId === "number") {
    await extensionApi.windows.remove(windowId).catch(() => undefined);
  }

  return true;
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
    (message.decision === "allow_once" || message.decision === "always_allow" || message.decision === "deny")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringTagArray(value: unknown): value is string[][] {
  return Array.isArray(value) && value.every((tag) => Array.isArray(tag) && tag.every((part) => typeof part === "string"));
}
