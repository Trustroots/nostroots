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

const elements = {
  status: mustElement("status"),
  npub: mustElement("npub"),
  nip05: mustElement("nip05"),
  nip05Help: mustElement("nip05-help"),
  nsec: mustElement("nsec"),
  keyActionsTitle: mustElement("key-actions-title"),
  keyActionsHelp: mustElement("key-actions-help"),
  keyImportControls: mustElement("key-import-controls"),
  keyRemoveControls: mustElement("key-remove-controls"),
  keyInput: mustElement("key-input") as HTMLTextAreaElement,
  importButton: mustElement("import-key") as HTMLButtonElement,
  generateButton: mustElement("generate-key") as HTMLButtonElement,
  removeButton: mustElement("remove-key") as HTMLButtonElement,
  revealButton: mustElement("reveal-key") as HTMLButtonElement,
  copyNpubButton: mustElement("copy-npub") as HTMLButtonElement,
  copyNip05Button: mustElement("copy-nip05") as HTMLButtonElement,
  copyNsecButton: mustElement("copy-nsec") as HTMLButtonElement,
  copyMnemonicButton: mustElement("copy-mnemonic") as HTMLButtonElement,
  generatedMnemonicPanel: mustElement("generated-mnemonic-panel"),
  generatedMnemonic: mustElement("generated-mnemonic"),
  permissions: mustElement("permissions"),
  buildTime: mustElement("settings-build-time"),
};

elements.buildTime.textContent = `Built ${__NOSTROOTS_EXTENSION_BUILD_TIME__}`;

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

elements.copyMnemonicButton.addEventListener("click", () => {
  void copyText(state.lastGeneratedMnemonic);
});

async function render(): Promise<void> {
  const privateKeyHex = await readPrivateKeyHex();
  const hasKey = Boolean(privateKeyHex);

  renderStatus(hasKey);
  elements.removeButton.disabled = !hasKey;
  elements.revealButton.disabled = !hasKey;
  elements.copyNpubButton.disabled = !hasKey;
  elements.copyNip05Button.disabled = true;
  elements.copyNsecButton.disabled = !hasKey || !state.showSecret;
  elements.copyMnemonicButton.disabled = !state.showSecret || !state.lastGeneratedMnemonic;
  elements.keyImportControls.hidden = hasKey;
  elements.keyRemoveControls.hidden = !hasKey;
  elements.generatedMnemonicPanel.hidden = !state.showSecret || !state.lastGeneratedMnemonic;

  if (privateKeyHex) {
    elements.keyActionsTitle.textContent = "Forget This Browser's Key";
    elements.keyActionsHelp.textContent =
      "This only removes the key from this browser. It does not delete your Nostroots account or remove a backup you saved somewhere else.";
    const publicKeyHex = publicKeyFromPrivateKey(privateKeyHex);
    const cachedNip05 = await readCachedTrustrootsNip05(publicKeyHex);
    elements.npub.textContent = npubFromPublicKey(publicKeyHex);
    elements.nip05Help.textContent = "";
    if (cachedNip05) {
      showTrustrootsIdentity(cachedNip05);
    } else {
      elements.nip05.textContent = "Checking relay.trustroots.org and nip42.trustroots.org...";
      void refreshTrustrootsIdentity(publicKeyHex, privateKeyHex);
    }
    elements.nsec.textContent = state.showSecret ? nsecFromPrivateKey(privateKeyHex) : "••••••••••••••••";
    elements.revealButton.textContent = state.showSecret ? "Hide" : "Reveal";
  } else {
    elements.keyActionsTitle.textContent = "Add a Nostroots Signing Key";
    elements.keyActionsHelp.textContent =
      "A signing key is the private key this browser uses to prove you are you on Nostroots. Import your existing key if you already have one, or generate a new one and save its recovery phrase somewhere safe.";
    elements.npub.textContent = "Add a key to see your public address.";
    elements.nip05.textContent = "Add a key to look up your Trustroots.org address.";
    elements.nip05Help.textContent = "";
    elements.nsec.textContent = "Your private key will stay in this browser.";
    elements.revealButton.textContent = "Reveal";
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
  elements.nip05.textContent = nip05;
  elements.nip05Help.textContent = "";
  elements.copyNip05Button.disabled = false;
}

function showTrustrootsIdentitySetupHelp(): void {
  elements.nip05.textContent = "No Trustroots.org address found for this key yet.";
  elements.nip05Help.textContent = "";
  const link = document.createElement("a");
  link.href = "https://www.trustroots.org/profile/edit/networks";
  link.textContent = "Trustroots profile networks";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  elements.nip05Help.append(
    "To connect this key to your Trustroots account, copy the public address above (the one starting with npub) and add it on ",
    link,
    ".",
  );
  elements.copyNip05Button.disabled = true;
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

const trusted = document.getElementById("trusted-origins");
if (trusted) {
  trusted.textContent = isTrustedOrigin("https://nos.trustroots.org")
    ? "*.trustroots.org can use this key automatically. Other sites will ask first."
    : `${EXTENSION_BRAND} is missing its Trustroots trust rule.`;
}
