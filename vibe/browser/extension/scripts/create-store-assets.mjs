import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = resolve(root, "src/ui/nostroots-logo.png");
const iconsDir = resolve(root, "src/ui/icons");
const storeDir = resolve(root, "store-assets/chrome");
const logoDataUrl = `data:image/png;base64,${(await readFile(logoPath)).toString("base64")}`;

await mkdir(iconsDir, { recursive: true });
await mkdir(storeDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  await run("sips", ["-z", String(size), String(size), logoPath, "--out", resolve(iconsDir, `icon-${size}.png`)]);
}

const browser = await chromium.launch({ executablePath: await localChromiumExecutablePath() });
try {
  await renderPng(browser, {
    width: 440,
    height: 280,
    output: resolve(storeDir, "small-promo-440x280.png"),
    html: promoHtml(440, 280, false),
  });

  await renderPng(browser, {
    width: 1400,
    height: 560,
    output: resolve(storeDir, "marquee-promo-1400x560.png"),
    html: promoHtml(1400, 560, true),
  });

  await renderPng(browser, {
    width: 1280,
    height: 800,
    output: resolve(storeDir, "screenshot-settings-1280x800.png"),
    html: settingsScreenshotHtml(),
  });
} finally {
  await browser.close();
}

await writeFile(
  resolve(storeDir, "listing-notes.md"),
  `# Chrome Web Store listing assets

Generated with:

\`\`\`bash
cd vibe/browser/extension
node scripts/create-store-assets.mjs
\`\`\`

Upload these in the Chrome Web Store Developer Dashboard:

- \`small-promo-440x280.png\`
- \`marquee-promo-1400x560.png\` (optional but ready)
- \`screenshot-settings-1280x800.png\`

The packaged extension ZIP includes the generated manifest icons from \`src/ui/icons/\`.

Suggested short description:

Small NIP-07 signer for Nostroots and compatible Nostr web apps.

Suggested privacy policy URL:

https://nos.trustroots.org/privacy/
`,
);

console.log(`Created Chrome Web Store assets in ${storeDir}`);

async function renderPng(browser, { width, height, output, html }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: output, fullPage: false });
  await page.close();
}

function promoHtml(width, height, wide) {
  const logoSize = wide ? 170 : 90;
  const titleSize = wide ? 70 : 31;
  const subtitleSize = wide ? 29 : 17;
  const gap = wide ? 46 : 20;
  const padding = wide ? 78 : 28;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      font-family: Nunito, Avenir Next, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #08261f;
      background:
        radial-gradient(circle at 84% 18%, rgba(238, 134, 25, 0.24), transparent 24%),
        linear-gradient(135deg, #f7f8ef 0%, #e8f2dc 54%, #b8d9cd 100%);
    }
    main {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      gap: ${gap}px;
      padding: ${padding}px;
    }
    img {
      width: ${logoSize}px;
      height: ${logoSize}px;
      border-radius: 22px;
      box-shadow: 0 22px 54px rgba(0, 75, 63, 0.24);
    }
    h1 {
      margin: 0;
      font-size: ${titleSize}px;
      line-height: 0.96;
      letter-spacing: 0;
      color: #004b3f;
    }
    p {
      max-width: ${wide ? 760 : 260}px;
      margin: ${wide ? 24 : 12}px 0 0;
      font-size: ${subtitleSize}px;
      line-height: 1.28;
      font-weight: 750;
      color: #38564c;
    }
    .badge {
      display: inline-flex;
      margin-top: ${wide ? 30 : 14}px;
      padding: ${wide ? "12px 18px" : "7px 11px"};
      border-radius: 8px;
      background: #128a78;
      color: white;
      font-size: ${wide ? 22 : 13}px;
      font-weight: 850;
    }
  </style>
</head>
<body>
  <main>
    <img src="${logoDataUrl}" alt="">
    <section>
      <h1>Nostroots<br>Extension</h1>
      <p>Sign in to Nostroots and compatible Nostr web apps without sharing your private key.</p>
      <span class="badge">NIP-07 signer</span>
    </section>
  </main>
</body>
</html>`;
}

function settingsScreenshotHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1280px;
      height: 800px;
      overflow: hidden;
      font-family: Nunito, Avenir Next, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #10271f;
      background:
        linear-gradient(180deg, rgba(152, 173, 70, 0.18), transparent 360px),
        linear-gradient(90deg, rgba(49, 189, 166, 0.08), rgba(243, 181, 42, 0.08)),
        #f7f8ef;
    }
    .browser {
      width: 1120px;
      height: 690px;
      margin: 55px auto;
      overflow: hidden;
      border-radius: 8px;
      border: 1px solid #cad8cb;
      background: #fffdf4;
      box-shadow: 0 30px 80px rgba(0, 75, 63, 0.22);
    }
    .bar {
      height: 54px;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 0 18px;
      border-bottom: 1px solid #dbe3d2;
      background: #f2f4e7;
    }
    .dot { width: 13px; height: 13px; border-radius: 50%; background: #d0a337; }
    .dot:first-child { background: #ee8619; }
    .dot:nth-child(3) { background: #128a78; }
    .url {
      margin-left: 18px;
      flex: 1;
      height: 30px;
      display: flex;
      align-items: center;
      padding: 0 14px;
      border-radius: 8px;
      background: white;
      color: #5f7169;
      font-size: 14px;
      font-weight: 700;
    }
    .content {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 34px;
      padding: 42px;
    }
    .hero {
      display: grid;
      align-content: start;
      gap: 24px;
      padding-top: 4px;
    }
    .logo {
      width: 108px;
      height: 108px;
      border-radius: 16px;
      box-shadow: 0 18px 46px rgba(0, 75, 63, 0.18);
    }
    h1 {
      margin: 0;
      font-size: 48px;
      line-height: 1;
      letter-spacing: 0;
      color: #004b3f;
    }
    .intro {
      margin: 0;
      color: #5f7169;
      font-size: 20px;
      line-height: 1.38;
      font-weight: 700;
    }
    .panel {
      border: 1px solid #dbe3d2;
      border-radius: 8px;
      background: white;
      padding: 24px;
      box-shadow: 0 16px 36px rgba(0, 75, 63, 0.1);
    }
    .panel + .panel { margin-top: 18px; }
    h2 {
      margin: 0 0 16px;
      font-size: 24px;
      letter-spacing: 0;
      color: #08261f;
    }
    .field {
      margin-top: 14px;
    }
    label {
      display: block;
      margin-bottom: 6px;
      color: #5f7169;
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .row {
      height: 46px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 0 12px;
      border: 1px solid #dbe3d2;
      border-radius: 8px;
      background: #fffdf4;
      color: #24443a;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 15px;
    }
    button, .button {
      height: 36px;
      display: inline-flex;
      align-items: center;
      padding: 0 13px;
      border: 0;
      border-radius: 8px;
      background: #128a78;
      color: white;
      font: inherit;
      font-size: 14px;
      font-weight: 850;
    }
    .muted { color: #5f7169; }
    .permissions {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .permission {
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      border-radius: 8px;
      background: #f7f8ef;
      font-weight: 750;
      color: #38564c;
    }
  </style>
</head>
<body>
  <main class="browser">
    <div class="bar">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
      <div class="url">chrome-extension://nostroots/options.html</div>
    </div>
    <section class="content">
      <div class="hero">
        <img class="logo" src="${logoDataUrl}" alt="">
        <div>
          <h1>Nostroots Extension</h1>
          <p class="intro">A small NIP-07 signer for Nostroots and compatible Nostr web apps.</p>
        </div>
        <span class="button">Ready for Nostroots</span>
      </div>
      <div>
        <section class="panel">
          <h2>Your Nostroots Signing Key</h2>
          <div class="field">
            <label>Public address</label>
            <div class="row"><span>npub1k4...6qpz</span><button>Copy</button></div>
          </div>
          <div class="field">
            <label>Trustroots.org address</label>
            <div class="row"><span>alice@trustroots.org</span><button>Copy</button></div>
          </div>
          <div class="field">
            <label>Private key</label>
            <div class="row"><span>••••••••••••••••</span><button>Reveal</button></div>
          </div>
        </section>
        <section class="panel">
          <h2>Site Access</h2>
          <ul class="permissions">
            <li class="permission"><span>*.trustroots.org can use this key automatically.</span><span class="muted">Trusted</span></li>
            <li class="permission"><span>Other sites ask before signing.</span><span class="muted">User controlled</span></li>
          </ul>
        </section>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", rejectRun);
    child.on("exit", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function localChromiumExecutablePath() {
  const candidates = [
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next locally installed browser.
    }
  }

  return undefined;
}
