import { EXTENSION_BRAND } from "./shared/constants";
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
  readAllowedOrigins,
  readPrivateKeyHex,
  revokeAllowedOrigin,
  writePrivateKeyHex,
} from "./shared/storage";

const state = {
  showSecret: false,
  lastGeneratedMnemonic: "",
};

const elements = {
  status: mustElement("status"),
  npub: mustElement("npub"),
  nip05: mustElement("nip05"),
  nsec: mustElement("nsec"),
  keyInput: mustElement("key-input") as HTMLTextAreaElement,
  importButton: mustElement("import-key") as HTMLButtonElement,
  generateButton: mustElement("generate-key") as HTMLButtonElement,
  removeButton: mustElement("remove-key") as HTMLButtonElement,
  revealButton: mustElement("reveal-key") as HTMLButtonElement,
  copyNpubButton: mustElement("copy-npub") as HTMLButtonElement,
  copyNip05Button: mustElement("copy-nip05") as HTMLButtonElement,
  copyNsecButton: mustElement("copy-nsec") as HTMLButtonElement,
  generatedMnemonic: mustElement("generated-mnemonic"),
  permissions: mustElement("permissions"),
};

void render();

elements.importButton.addEventListener("click", () => {
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

elements.copyNpubButton.addEventListener("click", () => {
  void copyText(elements.npub.textContent || "");
});

elements.copyNip05Button.addEventListener("click", () => {
  void copyText(elements.nip05.textContent || "");
});

elements.copyNsecButton.addEventListener("click", () => {
  void copyText(elements.nsec.textContent || "");
});

async function render(): Promise<void> {
  const privateKeyHex = await readPrivateKeyHex();
  const hasKey = Boolean(privateKeyHex);

  elements.status.textContent = hasKey
    ? "You are ready to sign in with Nostroots."
    : "Add one key to start signing in with Nostroots.";
  elements.removeButton.disabled = !hasKey;
  elements.revealButton.disabled = !hasKey;
  elements.copyNpubButton.disabled = !hasKey;
  elements.copyNip05Button.disabled = true;
  elements.copyNsecButton.disabled = !hasKey || !state.showSecret;

  if (privateKeyHex) {
    const publicKeyHex = publicKeyFromPrivateKey(privateKeyHex);
    elements.npub.textContent = npubFromPublicKey(publicKeyHex);
    elements.nip05.textContent = "Checking relay.trustroots.org and nip42.trustroots.org...";
    elements.nsec.textContent = state.showSecret ? nsecFromPrivateKey(privateKeyHex) : "••••••••••••••••";
    elements.revealButton.textContent = state.showSecret ? "Hide" : "Reveal";
    void refreshTrustrootsIdentity(publicKeyHex, privateKeyHex);
  } else {
    elements.npub.textContent = "Add a key to see your public address.";
    elements.nip05.textContent = "Add a key to look up your Trustroots.org address.";
    elements.nsec.textContent = "Your private key will stay in this browser.";
    elements.revealButton.textContent = "Reveal";
    state.showSecret = false;
  }

  elements.generatedMnemonic.textContent = state.lastGeneratedMnemonic
    ? `Recovery phrase for the generated key: ${state.lastGeneratedMnemonic}`
    : "";

  await renderPermissions();
}

async function refreshTrustrootsIdentity(publicKeyHex: string, privateKeyHex: string): Promise<void> {
  const nip05 = await lookupTrustrootsNip05(publicKeyHex, privateKeyHex);
  const currentKey = await readPrivateKeyHex();
  if (currentKey !== privateKeyHex) return;

  if (nip05) {
    elements.nip05.textContent = nip05;
    elements.copyNip05Button.disabled = false;
  } else {
    elements.nip05.textContent = "No Trustroots.org address found for this key yet.";
    elements.copyNip05Button.disabled = true;
  }
}

async function renderPermissions(): Promise<void> {
  const origins = await readAllowedOrigins();
  const rows = origins.map((origin) => {
    const item = document.createElement("li");
    item.className = "permission-row";

    const text = document.createElement("span");
    text.textContent = `${hostForOrigin(origin)} (${origin})`;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Revoke";
    button.addEventListener("click", () => {
      void revokeAllowedOrigin(origin).then(render);
    });

    item.append(text, button);
    return item;
  });

  elements.permissions.textContent = "";
  if (rows.length === 0) {
    const item = document.createElement("li");
    item.className = "muted";
    item.textContent = "No non-Trustroots sites are remembered.";
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
  state.lastGeneratedMnemonic = "";
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
  if (!globalThis.confirm("Forget this key and clear remembered site approvals?")) return;

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

const trusted = document.getElementById("trusted-origins");
if (trusted) {
  trusted.textContent = isTrustedOrigin("https://nos.trustroots.org")
    ? "*.trustroots.org can use this key automatically. Other sites will ask first."
    : `${EXTENSION_BRAND} is missing its Trustroots trust rule.`;
}
