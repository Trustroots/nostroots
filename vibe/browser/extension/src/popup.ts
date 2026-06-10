import { lookupTrustrootsNip05 } from "./shared/identity";
import { npubFromPublicKey, publicKeyFromPrivateKey } from "./shared/keys";
import { readPrivateKeyHex } from "./shared/storage";

const status = mustElement("popup-status");
const npub = mustElement("popup-npub");
const nip05 = mustElement("popup-nip05");
const optionsButton = mustElement("open-options") as HTMLButtonElement;
const trustrootsButton = mustElement("open-trustroots") as HTMLButtonElement;

void render();

optionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

trustrootsButton.addEventListener("click", () => {
  void chrome.tabs.create({ url: "https://nos.trustroots.org/" });
});

async function render(): Promise<void> {
  const key = await readPrivateKeyHex();
  if (!key) {
    status.textContent = "No key yet.";
    npub.textContent = "Open settings to add the one key you want to use here.";
    nip05.textContent = "Add a key to look up your Trustroots.org address.";
    return;
  }

  const publicKeyHex = publicKeyFromPrivateKey(key);
  status.textContent = "Ready for Nostroots.";
  npub.textContent = npubFromPublicKey(publicKeyHex);
  nip05.textContent = "Checking Trustroots.org address...";
  const foundNip05 = await lookupTrustrootsNip05(publicKeyHex, key);
  nip05.textContent = foundNip05 || "No Trustroots.org address found yet.";
}

function mustElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
}
