import { MESSAGE_SOURCE_PROMPT } from "./shared/constants";
import { hostForOrigin } from "./shared/origins";

type Decision = "allow_once" | "always_allow" | "deny";

const params = new URLSearchParams(window.location.search);
const promptId = params.get("promptId") || "";
const origin = params.get("origin") || "";
const method = params.get("method") || "NIP-07";
const preview = params.get("preview") || "";

mustElement("origin").textContent = hostForOrigin(origin);
mustElement("detail").textContent = `${origin} would like to use your Nostroots key for ${method}.`;

const previewElement = mustElement("preview");
if (preview) {
  renderPreview(previewElement, method, preview);
} else {
  renderPreview(previewElement, method);
}

bindDecision("allow-once", "allow_once");
bindDecision("always-allow", "always_allow");
bindDecision("deny", "deny");

function bindDecision(id: string, decision: Decision): void {
  mustElement(id).addEventListener("click", () => {
    chrome.runtime.sendMessage({
      source: MESSAGE_SOURCE_PROMPT,
      promptId,
      decision,
    });
  });
}

function renderPreview(container: HTMLElement, method: string, rawPreview = ""): void {
  const summary = summarizeRequest(method, rawPreview);
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
      definition.textContent = value;
      list.append(term, definition);
    }
    container.append(list);
  }
}

function summarizeRequest(
  method: string,
  rawPreview: string,
): { title: string; description: string; details: Array<[string, string]> } {
  if (method === "getPublicKey") {
    return {
      title: "Share your public address",
      description: "This lets the site know which Nostr profile you want to use.",
      details: [],
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
