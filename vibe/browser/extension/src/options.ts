import { EXTENSION_BRAND, nip07MethodLabel, STORAGE_KEYS } from "./shared/constants";
import { extensionApi } from "./shared/extension-api";
import { lookupTrustrootsNip05 } from "./shared/identity";
import {
  generateKey,
  keyImportErrorMessage,
  npubFromPublicKey,
  nsecFromPrivateKey,
  parseKeyInput,
  publicKeyFromPrivateKey,
} from "./shared/keys";
import { hostForOrigin, isTrustedOrigin } from "./shared/origins";
import {
  clearPrivateKey,
  readAllowedOriginAccess,
  readCachedTrustrootsNip05,
  readPrivateKeyHex,
  revokeAllowedOrigin,
  writeCachedTrustrootsNip05,
  writePrivateKeyHex,
} from "./shared/storage";

declare const __NOSTROOTS_EXTENSION_BUILD_TIME__: string;

const state = {
  showSecret: false,
  lastGeneratedMnemonic: "",
};

const NOSTROOTS_WEB_URL = "https://nos.trustroots.org/";
const SVG_NS = "http://www.w3.org/2000/svg";
type IconSpec = Array<{
  tag: "circle" | "path";
  attributes: Record<string, string>;
}>;
const EYE_ICON: IconSpec = [
  { tag: "path", attributes: { d: "M2.1 12s3.4-6.5 9.9-6.5 9.9 6.5 9.9 6.5-3.4 6.5-9.9 6.5S2.1 12 2.1 12Z" } },
  { tag: "circle", attributes: { cx: "12", cy: "12", r: "3" } },
];
const EYE_OFF_ICON: IconSpec = [
  { tag: "path", attributes: { d: "M3 3l18 18" } },
  {
    tag: "path",
    attributes: {
      d: "M10.7 5.7A10.3 10.3 0 0 1 12 5.6c6.5 0 9.9 6.4 9.9 6.4a18 18 0 0 1-3.1 3.8",
    },
  },
  { tag: "path", attributes: { d: "M14.1 14.1A3 3 0 0 1 9.9 9.9" } },
  {
    tag: "path",
    attributes: {
      d: "M6.4 6.4A17.6 17.6 0 0 0 2.1 12s3.4 6.5 9.9 6.5c1.7 0 3.2-.4 4.5-1",
    },
  },
];
const TRASH_ICON: IconSpec = [
  { tag: "path", attributes: { d: "M3 6h18" } },
  { tag: "path", attributes: { d: "M8 6V4h8v2" } },
  { tag: "path", attributes: { d: "M19 6l-1 14H6L5 6" } },
  { tag: "path", attributes: { d: "M10 11v5" } },
  { tag: "path", attributes: { d: "M14 11v5" } },
];

const elements = {
  status: mustElement("status"),
  npub: mustElement("npub") as HTMLElement,
  nsec: mustElement("nsec") as HTMLElement,
  keyActionsTitle: mustElement("key-actions-title"),
  keyActionsHelp: mustElement("key-actions-help"),
  keyDetails: mustElement("key-details"),
  keyImportControls: mustElement("key-import-controls"),
  keyRemoveControls: mustElement("key-remove-controls"),
  keyInput: mustElement("key-input") as HTMLTextAreaElement,
  importButton: mustElement("import-key") as HTMLButtonElement,
  generateButton: mustElement("generate-key") as HTMLButtonElement,
  removeButton: mustElement("remove-key") as HTMLButtonElement,
  revealButton: mustElement("reveal-key") as HTMLButtonElement,
  copyMnemonicButton: mustElement("copy-mnemonic") as HTMLButtonElement,
  generatedMnemonicPanel: mustElement("generated-mnemonic-panel"),
  generatedMnemonic: mustElement("generated-mnemonic"),
  identityStatus: mustElement("trustroots-identity-status") as HTMLAnchorElement,
  permissions: mustElement("permissions"),
  buildTime: mustElement("settings-build-time"),
};

elements.buildTime.textContent = `Built ${__NOSTROOTS_EXTENSION_BUILD_TIME__}`;
elements.removeButton.replaceChildren(createIcon(TRASH_ICON));

void render();

elements.importButton.addEventListener("click", () => {
  void importKey();
});

elements.keyInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  void importKey();
});

elements.generateButton.addEventListener("click", () => {
  void generateAndStoreKey();
});

elements.removeButton.addEventListener("click", () => {
  void removeKey();
});

elements.revealButton.addEventListener("click", () => {
  state.showSecret = !state.showSecret;
  void render();
});

elements.npub.addEventListener("click", () => {
  void copyText(elements.npub.textContent || "");
});
elements.npub.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  void copyText(elements.npub.textContent || "");
});

elements.nsec.addEventListener("click", () => {
  if (state.showSecret) void copyText(elements.nsec.textContent || "");
});
elements.nsec.addEventListener("keydown", (event) => {
  if (!state.showSecret || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  void copyText(elements.nsec.textContent || "");
});

elements.copyMnemonicButton.addEventListener("click", () => {
  void copyText(state.lastGeneratedMnemonic);
});

extensionApi.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[STORAGE_KEYS.allowedOriginAccess]) return;
  void renderPermissions();
});

async function render(): Promise<void> {
  const privateKeyHex = await readPrivateKeyHex();
  const hasKey = Boolean(privateKeyHex);

  renderStatus(hasKey);
  elements.removeButton.disabled = !hasKey;
  elements.revealButton.disabled = !hasKey;
  elements.copyMnemonicButton.disabled = !state.showSecret || !state.lastGeneratedMnemonic;
  elements.keyDetails.hidden = !hasKey;
  elements.keyImportControls.hidden = hasKey;
  elements.keyRemoveControls.hidden = !hasKey;
  elements.generatedMnemonicPanel.hidden = !state.showSecret || !state.lastGeneratedMnemonic;

  if (privateKeyHex) {
    elements.keyActionsTitle.textContent = "Your Nostroots Signing Key";
    elements.keyActionsHelp.textContent =
      "Stored only in this browser. Keep the private key secret and make sure you have a backup somewhere safe.";
    const publicKeyHex = publicKeyFromPrivateKey(privateKeyHex);
    const cachedNip05 = await readCachedTrustrootsNip05(publicKeyHex);
    elements.npub.textContent = npubFromPublicKey(publicKeyHex);
    setCopyable(elements.npub, true, "Copy public address");
    if (cachedNip05) {
      showTrustrootsIdentity(cachedNip05);
    } else {
      hideTrustrootsIdentityStatus();
      void refreshTrustrootsIdentity(publicKeyHex, privateKeyHex);
    }
    elements.nsec.textContent = state.showSecret ? nsecFromPrivateKey(privateKeyHex) : "••••••••••••••••";
    setCopyable(elements.nsec, state.showSecret, state.showSecret ? "Copy private key" : "");
    setRevealButtonState(state.showSecret);
  } else {
    elements.keyActionsTitle.textContent = "Add a Nostroots Signing Key";
    elements.keyActionsHelp.textContent =
      "A signing key is the private key this browser uses to prove you are you on Nostroots. Import your existing key if you already have one, or generate a new one and save its recovery phrase somewhere safe.";
    elements.npub.textContent = "";
    setCopyable(elements.npub, false, "");
    hideTrustrootsIdentityStatus();
    elements.nsec.textContent = "";
    setCopyable(elements.nsec, false, "");
    setRevealButtonState(false);
    state.showSecret = false;
  }

  elements.generatedMnemonic.textContent = state.lastGeneratedMnemonic
    ? state.lastGeneratedMnemonic
    : "";

  await renderPermissions();
}

function renderStatus(hasKey: boolean): void {
  elements.status.className = "muted";
  if (!hasKey) {
    elements.status.textContent = "Add one key to start signing in with Nostroots.";
    return;
  }

  const link = document.createElement("a");
  link.href = NOSTROOTS_WEB_URL;
  link.textContent = "Nostroots";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  elements.status.replaceChildren("You are ready to sign in with ", link, ".");
}

async function refreshTrustrootsIdentity(publicKeyHex: string, privateKeyHex: string): Promise<void> {
  const nip05 = await lookupTrustrootsNip05(publicKeyHex, privateKeyHex);
  const currentKey = await readPrivateKeyHex();
  if (currentKey !== privateKeyHex) return;

  if (nip05) {
    await writeCachedTrustrootsNip05(publicKeyHex, nip05);
    showTrustrootsIdentity(nip05);
  } else {
    showTrustrootsIdentitySetupHelp();
  }
}

function showTrustrootsIdentity(nip05: string): void {
  const profileUrl = trustrootsProfileUrlFromNip05(nip05);
  if (profileUrl) {
    elements.identityStatus.hidden = false;
    elements.identityStatus.href = profileUrl;
    elements.identityStatus.textContent = nip05;
    elements.identityStatus.title = nip05;
  }
}

function showTrustrootsIdentitySetupHelp(): void {
  hideTrustrootsIdentityStatus();
}

function hideTrustrootsIdentityStatus(): void {
  elements.identityStatus.hidden = true;
  elements.identityStatus.removeAttribute("href");
  elements.identityStatus.textContent = "";
  elements.identityStatus.removeAttribute("title");
}

function trustrootsProfileUrlFromNip05(nip05: string): string | null {
  const [username, domain] = nip05.toLowerCase().split("@");
  if (!username || domain !== "trustroots.org") return null;
  return `https://www.trustroots.org/profile/${encodeURIComponent(username)}`;
}

function setCopyable(element: HTMLElement, copyable: boolean, title: string): void {
  element.dataset.copyable = copyable ? "true" : "false";
  if (title) {
    element.title = title;
    element.setAttribute("role", "button");
    element.tabIndex = 0;
  } else {
    element.removeAttribute("title");
    element.removeAttribute("role");
    element.removeAttribute("tabindex");
  }
}

function setRevealButtonState(showingSecret: boolean): void {
  const label = showingSecret ? "Hide private key" : "Reveal private key";
  elements.revealButton.replaceChildren(createIcon(showingSecret ? EYE_OFF_ICON : EYE_ICON));
  elements.revealButton.setAttribute("aria-label", label);
  elements.revealButton.title = label;
}

async function renderPermissions(): Promise<void> {
  const accessEntries = await readAllowedOriginAccess();
  const rows = accessEntries.map((entry) => {
    const item = document.createElement("li");
    item.className = "permission-row";

    const text = document.createElement("span");
    text.className = "permission-summary";

    const link = document.createElement("a");
    link.href = entry.origin;
    link.textContent = hostForOrigin(entry.origin);
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const actionList = document.createElement("span");
    actionList.className = "permission-actions";
    const labels = entry.all ? ["All actions"] : entry.methods.map(nip07MethodLabel);
    for (const label of labels) {
      const badge = document.createElement("span");
      badge.className = "permission-action";
      badge.textContent = label;
      actionList.append(badge);
    }
    text.append(link, actionList);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button subtle-icon-button";
    button.replaceChildren(createIcon(TRASH_ICON));
    button.setAttribute("aria-label", `Revoke ${hostForOrigin(entry.origin)} access`);
    button.title = `Revoke ${hostForOrigin(entry.origin)} access`;
    button.addEventListener("click", () => {
      void revokeAllowedOrigin(entry.origin).then(render);
    });

    item.append(text, button);
    return item;
  });

  elements.permissions.textContent = "";
  if (rows.length === 0) {
    const item = document.createElement("li");
    item.className = "muted";
    item.textContent = "No other sites have access yet.";
    elements.permissions.append(item);
  } else {
    elements.permissions.append(...rows);
  }
}

async function importKey(): Promise<void> {
  const parsed = parseKeyInput(elements.keyInput.value);
  if (!parsed.ok) {
    showMessage(keyImportErrorMessage(parsed), "error");
    return;
  }

  const current = await readPrivateKeyHex();
  if (current && current !== parsed.privateKeyHex && !confirmReplacement()) return;

  await writePrivateKeyHex(parsed.privateKeyHex);
  elements.keyInput.value = "";
  state.showSecret = false;
  state.lastGeneratedMnemonic = parsed.source === "mnemonic" ? parsed.mnemonic : "";
  showMessage("All set. Your key is ready, and old site approvals were cleared.", "success");
  await render();
}

async function generateAndStoreKey(): Promise<void> {
  const current = await readPrivateKeyHex();
  if (current && !confirmReplacement()) return;

  const generated = generateKey();
  await writePrivateKeyHex(generated.privateKeyHex);
  state.showSecret = true;
  state.lastGeneratedMnemonic = generated.mnemonic;
  showMessage("New key created. Save the recovery phrase before you close this page.", "success");
  await render();
}

async function removeKey(): Promise<void> {
  const current = await readPrivateKeyHex();
  if (!current) return;
  if (
    !globalThis.confirm(
      [
        "Forget this key from this browser and clear remembered site approvals?",
        "",
        "Before continuing, make sure you have a copy of this private key saved somewhere safe, such as a password manager or written recovery phrase.",
        "",
        "Trustroots does not have a copy of your private key and cannot recover it for you. If this browser is your only copy, forgetting it may permanently lock you out of this Nostroots identity.",
      ].join("\n"),
    )
  ) {
    return;
  }

  await clearPrivateKey();
  state.showSecret = false;
  state.lastGeneratedMnemonic = "";
  showMessage("The key was forgotten on this browser.", "success");
  await render();
}

function confirmReplacement(): boolean {
  return globalThis.confirm("Use this key instead? Remembered site approvals will be cleared.");
}

function showMessage(message: string, kind: "success" | "error"): void {
  elements.status.textContent = message;
  elements.status.className = kind;
}

async function copyText(text: string): Promise<void> {
  if (!text || text.includes("No ") || text.includes("•") || text.includes("Checking") || text.includes("Add a key")) return;
  await navigator.clipboard.writeText(text);
  showMessage("Copied.", "success");
}

function mustElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}

function createIcon(spec: IconSpec): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("focusable", "false");

  for (const childSpec of spec) {
    const child = document.createElementNS(SVG_NS, childSpec.tag);
    for (const [name, value] of Object.entries(childSpec.attributes)) {
      child.setAttribute(name, value);
    }
    svg.append(child);
  }

  return svg;
}

const trusted = document.getElementById("trusted-origins");
if (trusted) {
  trusted.textContent = "";
  if (isTrustedOrigin(NOSTROOTS_WEB_URL)) {
    const link = document.createElement("a");
    link.href = NOSTROOTS_WEB_URL;
    link.textContent = "*.trustroots.org";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    trusted.append(link, " can use this key automatically. Other sites will ask first.");
  } else {
    trusted.textContent = `${EXTENSION_BRAND} is missing its Trustroots trust rule.`;
  }
}
