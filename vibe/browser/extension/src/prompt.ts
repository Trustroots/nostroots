import { isKnownNip07Method, MESSAGE_SOURCE_PROMPT, nip07MethodLabel, type Nip07Method } from "./shared/constants";
import { extensionApi } from "./shared/extension-api";
import { npubFromPublicKey, publicKeyFromPrivateKey } from "./shared/keys";
import { hostForOrigin } from "./shared/origins";
import { readPrivateKeyHex } from "./shared/storage";

type Decision = "allow_once" | "always_allow_method" | "always_allow_all" | "deny";

const params = new URLSearchParams(window.location.search);
const promptId = params.get("promptId") || "";
const origin = params.get("origin") || "";
const method = params.get("method") || "NIP-07";
const methods = methodsFromParams(params);
const preview = params.get("preview") || "";

mustElement("origin").textContent = hostForOrigin(origin);
renderDetail(methods);

const previewElement = mustElement("preview");
if (preview) {
  void renderPreview(previewElement, method, preview);
} else {
  void renderPreview(previewElement, method);
}

bindDecision("allow-once", "allow_once");
bindDecision("always-allow-method", "always_allow_method");
bindDecision("always-allow-all", "always_allow_all");
bindDecision("deny", "deny");

extensionApi.runtime.onMessage.addListener((message) => {
  if (!isPromptUpdate(message)) return false;
  renderDetail(message.methods);
  return false;
});

function bindDecision(id: string, decision: Decision): void {
  mustElement(id).addEventListener("click", () => {
    void extensionApi.runtime.sendMessage({
      source: MESSAGE_SOURCE_PROMPT,
      promptId,
      decision,
    });
  });
}

function renderDetail(currentMethods: Nip07Method[]): void {
  const detail = mustElement("detail");
  detail.textContent = "";
  detail.append(`${origin} would like to use your Nostroots key for:`);

  const list = document.createElement("span");
  list.className = "prompt-action-list";
  for (const currentMethod of currentMethods) {
    const item = document.createElement("span");
    item.className = "prompt-action";
    item.textContent = nip07MethodLabel(currentMethod);
    list.append(item);
  }
  detail.append(list);
}

function methodsFromParams(searchParams: URLSearchParams): Nip07Method[] {
  const values = searchParams
    .getAll("methods")
    .flatMap((value) => value.split(","))
    .filter(isKnownNip07Method);
  if (values.length > 0) return Array.from(new Set(values));
  return isKnownNip07Method(method) ? [method] : [];
}

function isPromptUpdate(message: unknown): message is {
  source: typeof MESSAGE_SOURCE_PROMPT;
  promptId: string;
  update: "methods";
  methods: Nip07Method[];
} {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { source?: unknown }).source === MESSAGE_SOURCE_PROMPT &&
    (message as { promptId?: unknown }).promptId === promptId &&
    (message as { update?: unknown }).update === "methods" &&
    Array.isArray((message as { methods?: unknown }).methods)
  );
}

async function renderPreview(container: HTMLElement, method: string, rawPreview = ""): Promise<void> {
  const summary = await summarizeRequest(method, rawPreview);
  container.textContent = "";

  const title = document.createElement("strong");
  title.textContent = summary.title;

  const description = document.createElement("p");
  description.textContent = summary.description;

  container.append(title, description);

  if (summary.details.length > 0) {
    const list = document.createElement("dl");
    for (const [label, value] of summary.details) {
      const term = document.createElement("dt");
      term.textContent = label;
      const definition = document.createElement("dd");
      if (label === "Public address") {
        const address = document.createElement("code");
        address.textContent = value;
        definition.append(address);
      } else {
        definition.textContent = value;
      }
      list.append(term, definition);
    }
    container.append(list);
  }
}

async function summarizeRequest(
  method: string,
  rawPreview: string,
): Promise<{ title: string; description: string; details: Array<[string, string]> }> {
  if (method === "getPublicKey") {
    const privateKeyHex = await readPrivateKeyHex();
    const npub = privateKeyHex ? npubFromPublicKey(publicKeyFromPrivateKey(privateKeyHex)) : "";
    return {
      title: "Share your public address",
      description: "This lets the site know which Nostr profile you want to use.",
      details: npub ? [["Public address", npub]] : [],
    };
  }

  if (method.startsWith("nip44.encrypt") || method.startsWith("nip04.encrypt")) {
    return {
      title: "Encrypt a private message",
      description: "The site can create a message that only the recipient can read.",
      details: [],
    };
  }

  if (method.startsWith("nip44.decrypt") || method.startsWith("nip04.decrypt")) {
    return {
      title: "Read a private message",
      description: "The site can decrypt one message using your key.",
      details: [],
    };
  }

  const event = parseEventPreview(rawPreview);
  if (!event) {
    return {
      title: "Use your Nostroots key",
      description: "This approves one Nostr action from this site.",
      details: [],
    };
  }

  if (event.kind === 22242) {
    const relay = firstTagValue(event.tags, "relay");
    return {
      title: "Sign in to a relay",
      description: "This proves the relay is talking to your Nostr profile. Your private key is not shared.",
      details: relay ? [["Relay", relay]] : [],
    };
  }

  if (event.kind === 1) {
    return {
      title: "Sign a public note",
      description: "This lets the site publish a note as your Nostr profile.",
      details: event.content ? [["Note", shorten(event.content)]] : [],
    };
  }

  if (event.kind === 4 || event.kind === 44 || event.kind === 1059) {
    return {
      title: "Sign a private message",
      description: "This lets the site send an encrypted message from your Nostr profile.",
      details: [["Event kind", String(event.kind)]],
    };
  }

  return {
    title: "Sign a Nostr event",
    description: "This lets the site do one signed action as your Nostr profile.",
    details: [
      ["Event kind", String(event.kind)],
      ...(event.content ? ([["Content", shorten(event.content)]] as Array<[string, string]>) : []),
    ],
  };
}

function parseEventPreview(rawPreview: string): { kind?: number; content?: string; tags?: string[][] } | null {
  try {
    const parsed = JSON.parse(rawPreview);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as { kind?: number; content?: string; tags?: string[][] };
  } catch {
    return null;
  }
}

function firstTagValue(tags: unknown, name: string): string {
  if (!Array.isArray(tags)) return "";
  for (const tag of tags) {
    if (Array.isArray(tag) && tag[0] === name && typeof tag[1] === "string") {
      return tag[1];
    }
  }
  return "";
}

function shorten(value: string): string {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function mustElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}
