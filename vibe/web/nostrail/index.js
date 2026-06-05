export const NOSTRAIL_LOCATION_EVENT_KIND = 24111;
export const DEFAULT_SESSION_SECONDS = 7200;
export const DEFAULT_UPDATE_INTERVAL_MS = 300000;
export const DEFAULT_APPROXIMATE_ACCURACY_M = 500;

export const NIP42_AUTH_KIND = 22242;
export const DEFAULT_RELAYS = [
  "wss://nip42.trustroots.org",
  "wss://relay.trustroots.org",
  "wss://relay.nomadwiki.org",
];

const PAYLOAD_TYPES = new Set([
  "trustroots.location.v1",
  "trustroots.location.invite.v1",
  "trustroots.location.stop.v1",
]);

const PLUS_CODE_ALPHABET = "23456789CFGHJMPQRVWX";
const LATITUDE_MAX = 90;
const LONGITUDE_MAX = 180;
const PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125];
const HEX_64_RE = /^[0-9a-f]{64}$/;
const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/i;
const NIP05_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

const state = {
  signer: {
    status: "none",
    pubkey: "",
    text: "Checking signer...",
  },
  recipients: new Map(),
  peers: new Map(),
  currentArea: null,
  session: null,
  publishTimer: 0,
  relaySockets: [],
  busy: false,
};

function byId(id) {
  return document.getElementById(id);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortValue(value, head = 9, tail = 6) {
  const text = String(value || "");
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value;
}

function setStatus(value, tone = "") {
  const el = byId("app-status");
  if (!el) return;
  el.textContent = value;
  el.classList.toggle("error", tone === "error");
}

function setRecipientFeedback(value, tone = "") {
  const el = byId("recipient-feedback");
  if (!el) return;
  el.textContent = value;
  el.classList.toggle("error", tone === "error");
}

export function inspectNostrailNip7(provider = globalThis.window?.nostr) {
  const hasProvider = provider && typeof provider === "object";
  const hasGetPublicKey = typeof provider?.getPublicKey === "function";
  const hasSignEvent = typeof provider?.signEvent === "function";
  const hasNip44Encrypt = typeof provider?.nip44?.encrypt === "function";
  const hasNip44Decrypt = typeof provider?.nip44?.decrypt === "function";

  if (hasGetPublicKey && hasSignEvent && hasNip44Encrypt && hasNip44Decrypt) {
    return {
      status: "full",
      text: provider.__nostrootsBrowser
        ? "Nostroots Browser signer connected."
        : "NIP-07 signer connected.",
    };
  }
  if (hasGetPublicKey || hasSignEvent || hasNip44Encrypt || hasNip44Decrypt) {
    return {
      status: "partial",
      text: "NIP-07 signer needs signing and NIP-44 encryption.",
    };
  }
  if (hasProvider) {
    return {
      status: "partial",
      text: "NIP-07 signer is incomplete.",
    };
  }
  return {
    status: "none",
    text: "No full NIP-07 signer detected.",
  };
}

export function trustrootsProfileUrlToUsername(input) {
  const text = String(input || "").trim();
  let url;
  try {
    url = new URL(text);
  } catch (_) {
    return "";
  }
  const host = url.hostname.toLowerCase();
  if (host !== "trustroots.org" && host !== "www.trustroots.org") return "";
  const parts = url.pathname.split("/").filter(Boolean);
  const markerIndex = parts.findIndex((part) => ["profile", "profiles", "user", "users"].includes(part.toLowerCase()));
  const candidate = markerIndex >= 0 ? parts[markerIndex + 1] : "";
  return USERNAME_RE.test(candidate || "") ? candidate.toLowerCase() : "";
}

function bech32Polymod(values) {
  const generator = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i += 1) {
      if ((top >> i) & 1) chk ^= generator[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp) {
  const out = [];
  for (let i = 0; i < hrp.length; i += 1) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i += 1) out.push(hrp.charCodeAt(i) & 31);
  return out;
}

function bech32Decode(value) {
  const text = String(value || "");
  if (!text || text.length < 8 || text !== text.toLowerCase()) return null;
  const split = text.lastIndexOf("1");
  if (split <= 0 || split + 7 > text.length) return null;
  const hrp = text.slice(0, split);
  const data = [];
  for (const char of text.slice(split + 1)) {
    const index = BECH32_CHARSET.indexOf(char);
    if (index < 0) return null;
    data.push(index);
  }
  const checksum = bech32Polymod([...bech32HrpExpand(hrp), ...data]);
  if (checksum !== 1) return null;
  return { hrp, data: data.slice(0, -6) };
}

function convertBits(data, fromBits, toBits, pad) {
  let acc = 0;
  let bits = 0;
  const maxv = (1 << toBits) - 1;
  const result = [];
  for (const value of data) {
    if (value < 0 || value >> fromBits) return null;
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) result.push((acc << (toBits - bits)) & maxv);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    return null;
  }
  return result;
}

export function npubToHex(input) {
  const decoded = bech32Decode(String(input || "").trim().toLowerCase());
  if (!decoded || decoded.hrp !== "npub") return "";
  const bytes = convertBits(decoded.data, 5, 8, false);
  if (!bytes || bytes.length !== 32) return "";
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeRecipientInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return { ok: false, kind: "empty", input: raw };

  const fromProfile = trustrootsProfileUrlToUsername(raw);
  if (fromProfile) {
    const handle = `${fromProfile}@trustroots.org`;
    return {
      ok: true,
      type: "nip05",
      value: handle,
      display: `@${fromProfile}`,
      duplicateKey: `nip05:${handle}`,
      input: raw,
    };
  }

  const lower = raw.toLowerCase();
  if (HEX_64_RE.test(lower)) {
    return {
      ok: true,
      type: "hex",
      value: lower,
      display: shortValue(lower),
      duplicateKey: `pubkey:${lower}`,
      input: raw,
    };
  }

  if (lower.startsWith("npub1")) {
    const hex = npubToHex(lower);
    if (!hex) return { ok: false, kind: "invalid", input: raw };
    return {
      ok: true,
      type: "hex",
      value: hex,
      display: shortValue(lower, 12, 6),
      duplicateKey: `pubkey:${hex}`,
      input: raw,
    };
  }

  if (NIP05_RE.test(lower)) {
    return {
      ok: true,
      type: "nip05",
      value: lower,
      display: lower,
      duplicateKey: `nip05:${lower}`,
      input: raw,
    };
  }

  const username = lower.startsWith("@") ? lower.slice(1) : lower;
  if (USERNAME_RE.test(username)) {
    const handle = `${username}@trustroots.org`;
    return {
      ok: true,
      type: "nip05",
      value: handle,
      display: `@${username}`,
      duplicateKey: `nip05:${handle}`,
      input: raw,
    };
  }

  return { ok: false, kind: "invalid", input: raw };
}

export function splitRecipientInput(input) {
  return String(input || "")
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function dedupeRecipientInputs(inputs) {
  const seen = new Set();
  const accepted = [];
  const rejected = [];
  for (const input of inputs) {
    const normalized = normalizeRecipientInput(input);
    if (!normalized.ok) {
      rejected.push(normalized);
      continue;
    }
    if (seen.has(normalized.duplicateKey)) continue;
    seen.add(normalized.duplicateKey);
    accepted.push(normalized);
  }
  return { accepted, rejected };
}

export function normalizeLongitude(lng) {
  let next = Number(lng);
  while (next > LONGITUDE_MAX) next -= 360;
  while (next < -LONGITUDE_MAX) next += 360;
  return next;
}

export function encodePlusCode(latitude, longitude, codeLength = 8) {
  const latNum = Number(latitude);
  const lngNum = normalizeLongitude(Number(longitude));
  if (
    !Number.isFinite(latNum) ||
    !Number.isFinite(lngNum) ||
    latNum < -LATITUDE_MAX ||
    latNum > LATITUDE_MAX ||
    lngNum < -LONGITUDE_MAX ||
    lngNum > LONGITUDE_MAX
  ) {
    return "";
  }

  let lat = latNum + LATITUDE_MAX;
  let lng = lngNum + LONGITUDE_MAX;
  let code = "";
  const numPairs = Math.ceil(codeLength / 2);

  for (let i = 0; i < numPairs; i += 1) {
    const resolution = PAIR_RESOLUTIONS[i] || PAIR_RESOLUTIONS[PAIR_RESOLUTIONS.length - 1];
    const latDigit = Math.min(PLUS_CODE_ALPHABET.length - 1, Math.floor(lat / resolution));
    const lngDigit = Math.min(PLUS_CODE_ALPHABET.length - 1, Math.floor(lng / resolution));
    code += PLUS_CODE_ALPHABET[latDigit];
    code += PLUS_CODE_ALPHABET[lngDigit];
    lat -= latDigit * resolution;
    lng -= lngDigit * resolution;
  }

  return `${code.slice(0, 8)}+${code.slice(8)}`;
}

export function decodePlusCodeCenter(code) {
  const clean = String(code || "").replace("+", "").toUpperCase();
  if (clean.length < 2) return null;
  let lat = -LATITUDE_MAX;
  let lng = -LONGITUDE_MAX;
  let resolution = 20;

  for (let i = 0; i < Math.min(clean.length, 10); i += 2) {
    const latChar = clean[i];
    const lngChar = clean[i + 1];
    if (!latChar || !lngChar || latChar === "0" || lngChar === "0") break;
    const latIndex = PLUS_CODE_ALPHABET.indexOf(latChar);
    const lngIndex = PLUS_CODE_ALPHABET.indexOf(lngChar);
    if (latIndex < 0 || lngIndex < 0) return null;
    resolution = PAIR_RESOLUTIONS[i / 2] || resolution;
    lat += latIndex * resolution;
    lng += lngIndex * resolution;
  }

  return {
    latitude: Math.max(-LATITUDE_MAX, Math.min(LATITUDE_MAX, lat + resolution / 2)),
    longitude: normalizeLongitude(lng + resolution / 2),
  };
}

export function snapApproximateArea(latitude, longitude) {
  const area = encodePlusCode(latitude, longitude, 8);
  const center = decodePlusCodeCenter(area) || { latitude: Number(latitude), longitude: Number(longitude) };
  return {
    area,
    centerLat: Number(center.latitude.toFixed(5)),
    centerLon: Number(center.longitude.toFixed(5)),
    accuracyM: DEFAULT_APPROXIMATE_ACCURACY_M,
  };
}

export function getExpirationUnix(event) {
  const tags = Array.isArray(event?.tags) ? event.tags : [];
  const raw = tags.find((tag) => Array.isArray(tag) && tag[0] === "expiration")?.[1];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function isNostrailEventExpired(event, atUnix = nowSeconds()) {
  const expiration = getExpirationUnix(event);
  return expiration > 0 && expiration <= atUnix;
}

export function decodeNostrailPayload(content) {
  let payload;
  try {
    payload = JSON.parse(String(content || ""));
  } catch (_) {
    return null;
  }
  if (!payload || typeof payload !== "object" || !PAYLOAD_TYPES.has(payload.type)) return null;
  if (payload.type === "trustroots.location.v1") {
    if (
      typeof payload.sessionId !== "string" ||
      typeof payload.area !== "string" ||
      !Number.isFinite(Number(payload.centerLat)) ||
      !Number.isFinite(Number(payload.centerLon)) ||
      !Number.isFinite(Number(payload.expiresAt))
    ) {
      return null;
    }
  }
  if (payload.type === "trustroots.location.stop.v1" && typeof payload.sessionId !== "string") return null;
  return payload;
}

export function makeLocationPayload({ sessionId, area, centerLat, centerLon, accuracyM, createdAt, expiresAt }) {
  return {
    type: "trustroots.location.v1",
    sessionId,
    area,
    centerLat,
    centerLon,
    accuracyM,
    createdAt,
    expiresAt,
  };
}

export function markerPositionForPubkey(pubkey) {
  const text = String(pubkey || "");
  let a = 0;
  let b = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (i % 2) b += code;
    else a += code;
  }
  return {
    left: 18 + (a % 64),
    top: 18 + (b % 54),
  };
}

async function refreshSigner() {
  const caps = inspectNostrailNip7(window.nostr);
  let pubkey = "";
  if (caps.status === "full") {
    try {
      const value = String(await window.nostr.getPublicKey()).trim().toLowerCase();
      if (HEX_64_RE.test(value)) pubkey = value;
    } catch (_) {
      state.signer = { status: "partial", pubkey: "", text: "Signer did not return a public key." };
      render();
      return false;
    }
  }
  state.signer = { ...caps, pubkey };
  render();
  if (pubkey) subscribeToRelays();
  return caps.status === "full" && Boolean(pubkey);
}

function watchForSigner() {
  const startedAt = Date.now();
  const timer = setInterval(async () => {
    const ok = await refreshSigner();
    if (ok || Date.now() - startedAt > 12000) clearInterval(timer);
  }, 350);
  void refreshSigner();
  window.addEventListener("focus", () => void refreshSigner());
}

async function resolveNip05(handle) {
  const [name, domain] = String(handle || "").toLowerCase().split("@");
  if (!name || !domain) throw new Error("Check this recipient.");
  const response = await fetch(`https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error("Could not look up this recipient.");
  const data = await response.json();
  const pubkey = String(data?.names?.[name] || "").toLowerCase();
  if (!HEX_64_RE.test(pubkey)) throw new Error("Trustroots profile does not expose a valid Nostr key.");
  return pubkey;
}

async function addRecipientInputs(inputs) {
  const { accepted, rejected } = dedupeRecipientInputs(inputs);
  let added = 0;
  let failed = rejected.length;

  for (const item of accepted) {
    let pubkey = item.type === "hex" ? item.value : "";
    try {
      if (!pubkey) pubkey = await resolveNip05(item.value);
    } catch (_) {
      failed += 1;
      state.recipients.set(`failed:${item.duplicateKey}`, {
        input: item.input,
        display: item.display,
        status: "Check",
        pubkey: "",
      });
      continue;
    }
    if (state.recipients.has(pubkey)) continue;
    state.recipients.set(pubkey, {
      input: item.input,
      display: item.display || shortValue(pubkey),
      status: "Ready",
      pubkey,
    });
    added += 1;
  }

  if (added && failed) setRecipientFeedback(`Added ${added}. Check ${failed}.`, "error");
  else if (added) setRecipientFeedback(`Added ${added} ${added === 1 ? "person" : "people"}.`);
  else if (failed) setRecipientFeedback("Check the highlighted recipient.", "error");
  else setRecipientFeedback("That person is already selected.");
  render();
}

function selectedRecipientPubkeys() {
  return [...state.recipients.values()].map((row) => row.pubkey).filter(Boolean);
}

function requestCurrentArea() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is unavailable in this browser."));
      return;
    }
    setStatus("Finding your approximate area...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.currentArea = snapApproximateArea(position.coords.latitude, position.coords.longitude);
        render();
        resolve(state.currentArea);
      },
      () => reject(new Error("Location permission was not available.")),
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 60000 },
    );
  });
}

function makeSessionId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `nostrail-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function signEventTemplate(template) {
  const pubkey = state.signer.pubkey || await window.nostr.getPublicKey();
  const signed = await window.nostr.signEvent({
    pubkey,
    created_at: template.created_at || nowSeconds(),
    kind: template.kind,
    tags: template.tags || [],
    content: template.content || "",
  });
  if (!signed?.id || !signed?.sig || !signed?.pubkey) throw new Error("Signer returned an incomplete event.");
  return signed;
}

async function encryptAndSignPayload(payload, recipientPubkey, expirationUnix) {
  const content = await window.nostr.nip44.encrypt(recipientPubkey, JSON.stringify(payload));
  return signEventTemplate({
    kind: NOSTRAIL_LOCATION_EVENT_KIND,
    content,
    tags: [
      ["expiration", String(expirationUnix)],
      ["p", recipientPubkey],
    ],
  });
}

async function publishToRelay(url, event) {
  return new Promise((resolve) => {
    let ws;
    let settled = false;
    const finish = (ok, message = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { ws?.close(); } catch (_) {}
      resolve({ ok, url, message });
    };
    const timeout = setTimeout(() => finish(false, "timeout"), 12000);

    try {
      ws = new WebSocket(url);
    } catch (error) {
      finish(false, error?.message || "connection failed");
      return;
    }

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify(["EVENT", event]));
    });
    ws.addEventListener("message", (message) => {
      let payload;
      try {
        payload = JSON.parse(message.data);
      } catch (_) {
        return;
      }
      if (Array.isArray(payload) && payload[0] === "AUTH" && payload[1]) {
        void signEventTemplate({
          kind: NIP42_AUTH_KIND,
          content: "",
          tags: [
            ["relay", url],
            ["challenge", String(payload[1])],
          ],
        })
          .then((authEvent) => {
            ws.send(JSON.stringify(["AUTH", authEvent]));
            ws.send(JSON.stringify(["EVENT", event]));
          })
          .catch((error) => finish(false, error?.message || "auth failed"));
      }
      if (Array.isArray(payload) && payload[0] === "OK" && payload[1] === event.id) {
        finish(Boolean(payload[2]), String(payload[3] || ""));
      }
    });
    ws.addEventListener("error", () => finish(false, "relay error"));
    ws.addEventListener("close", () => finish(false, "closed"));
  });
}

async function publishFanout(events) {
  let okCount = 0;
  for (const event of events) {
    const results = await Promise.all(DEFAULT_RELAYS.map((url) => publishToRelay(url, event)));
    if (results.some((result) => result.ok)) okCount += 1;
  }
  return okCount;
}

async function publishPayloadToRecipients(payload, recipients, expirationUnix) {
  const events = [];
  for (const recipient of recipients) {
    events.push(await encryptAndSignPayload(payload, recipient, expirationUnix));
  }
  const okCount = await publishFanout(events);
  return { okCount, eventCount: events.length };
}

async function publishInvite() {
  if (state.signer.status !== "full" || !state.signer.pubkey) {
    setStatus("Connect a full NIP-07 signer before sharing.", "error");
    return false;
  }
  const recipients = selectedRecipientPubkeys();
  if (!recipients.length) {
    setStatus("Add at least one person before sharing.", "error");
    return false;
  }
  const createdAt = nowSeconds();
  const result = await publishPayloadToRecipients(
    { type: "trustroots.location.invite.v1", message: "", createdAt },
    recipients,
    createdAt + 86400,
  );
  for (const pubkey of recipients) {
    const row = state.recipients.get(pubkey);
    if (row) row.status = result.okCount ? "Invited" : "Retry";
  }
  setStatus(result.okCount ? "Invite sent." : "Signed invite, but no relay accepted it.", result.okCount ? "" : "error");
  render();
  return result.okCount > 0;
}

async function publishCurrentLocation() {
  if (!state.session) throw new Error("Start sharing first.");
  const area = state.currentArea || await requestCurrentArea();
  const createdAt = nowSeconds();
  const payload = makeLocationPayload({
    sessionId: state.session.id,
    area: area.area,
    centerLat: area.centerLat,
    centerLon: area.centerLon,
    accuracyM: area.accuracyM,
    createdAt,
    expiresAt: state.session.expiresAt,
  });
  const result = await publishPayloadToRecipients(payload, state.session.recipients, state.session.expiresAt);
  for (const pubkey of state.session.recipients) {
    const row = state.recipients.get(pubkey);
    if (row) row.status = result.okCount ? "Updated" : "Retry";
  }
  render();
  return result;
}

async function startSharing() {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    if (state.signer.status !== "full" || !state.signer.pubkey) throw new Error("Connect a full NIP-07 signer before sharing.");
    const recipients = selectedRecipientPubkeys();
    if (!recipients.length) throw new Error("Add at least one person before sharing.");
    await requestCurrentArea();
    await publishInvite();
    state.session = {
      id: makeSessionId(),
      recipients,
      expiresAt: nowSeconds() + DEFAULT_SESSION_SECONDS,
    };
    const result = await publishCurrentLocation();
    if (!result.okCount) throw new Error("Signed location, but no relay accepted it.");
    clearInterval(state.publishTimer);
    state.publishTimer = setInterval(() => {
      if (!state.session) return;
      if (document.visibilityState === "hidden") {
        setStatus("Sharing is paused while the page is hidden.");
        return;
      }
      void publishCurrentLocation().catch(() => {
        setStatus("Could not send the latest area. Try sharing current area.", "error");
      });
    }, DEFAULT_UPDATE_INTERVAL_MS);
    setStatus("Sharing started. Keep this page open for foreground updates.");
  } catch (error) {
    setStatus(error?.message || "Could not start sharing.", "error");
  } finally {
    state.busy = false;
    render();
  }
}

async function shareCurrentArea() {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    await requestCurrentArea();
    const result = await publishCurrentLocation();
    setStatus(result.okCount ? "Current area shared." : "Signed update, but no relay accepted it.", result.okCount ? "" : "error");
  } catch (error) {
    setStatus(error?.message || "Could not share current area.", "error");
  } finally {
    state.busy = false;
    render();
  }
}

async function stopSharing() {
  if (state.busy || !state.session) return;
  state.busy = true;
  render();
  const session = state.session;
  try {
    const createdAt = nowSeconds();
    const result = await publishPayloadToRecipients(
      { type: "trustroots.location.stop.v1", sessionId: session.id, createdAt },
      session.recipients,
      createdAt + 300,
    );
    clearInterval(state.publishTimer);
    state.publishTimer = 0;
    state.session = null;
    for (const pubkey of session.recipients) {
      const row = state.recipients.get(pubkey);
      if (row) row.status = "Ready";
    }
    setStatus(result.okCount ? "Sharing stopped." : "Stopped locally. No relay confirmed the stop notice.", result.okCount ? "" : "error");
  } catch (error) {
    setStatus(error?.message || "Could not stop sharing.", "error");
  } finally {
    state.busy = false;
    render();
  }
}

function subscribeToRelays() {
  if (!state.signer.pubkey || state.relaySockets.length) return;
  let connected = 0;
  for (const url of DEFAULT_RELAYS) {
    try {
      const ws = new WebSocket(url);
      state.relaySockets.push(ws);
      const subscriptionMessage = [
        "REQ",
        `nostrail-${Math.random().toString(36).slice(2)}`,
        { kinds: [NOSTRAIL_LOCATION_EVENT_KIND], "#p": [state.signer.pubkey], limit: 200 },
      ];
      ws.addEventListener("open", () => {
        connected += 1;
        ws.send(JSON.stringify(subscriptionMessage));
        setText("relay-status", `${connected}/${DEFAULT_RELAYS.length} relays listening`);
      });
      ws.addEventListener("message", (message) => {
        let payload;
        try {
          payload = JSON.parse(message.data);
        } catch (_) {
          return;
        }
        if (Array.isArray(payload) && payload[0] === "AUTH" && payload[1]) {
          void signEventTemplate({
            kind: NIP42_AUTH_KIND,
            content: "",
            tags: [
              ["relay", url],
              ["challenge", String(payload[1])],
            ],
          }).then((authEvent) => {
            ws.send(JSON.stringify(["AUTH", authEvent]));
            ws.send(JSON.stringify(subscriptionMessage));
          });
        }
        if (Array.isArray(payload) && payload[0] === "EVENT" && payload[2]) {
          void consumeIncomingEvent(payload[2]);
        }
      });
      ws.addEventListener("error", () => {
        setText("relay-status", "Some relays unavailable");
      });
    } catch (_) {
      setText("relay-status", "Some relays unavailable");
    }
  }
}

async function consumeIncomingEvent(event) {
  if (
    !event ||
    event.kind !== NOSTRAIL_LOCATION_EVENT_KIND ||
    !HEX_64_RE.test(String(event.pubkey || "").toLowerCase()) ||
    isNostrailEventExpired(event)
  ) {
    return;
  }
  const recipients = new Set((event.tags || []).filter((tag) => Array.isArray(tag) && tag[0] === "p").map((tag) => tag[1]));
  if (!recipients.has(state.signer.pubkey)) return;

  let plain;
  try {
    plain = await window.nostr.nip44.decrypt(event.pubkey, event.content);
  } catch (_) {
    return;
  }
  const payload = decodeNostrailPayload(plain);
  if (!payload) return;
  if (payload.type === "trustroots.location.v1") {
    if (Number(payload.expiresAt) <= nowSeconds()) return;
    state.peers.set(event.pubkey, {
      pubkey: event.pubkey,
      area: payload.area,
      centerLat: payload.centerLat,
      centerLon: payload.centerLon,
      receivedAt: nowSeconds(),
      sessionId: payload.sessionId,
      expiresAt: payload.expiresAt,
    });
    setStatus("Shared location received.");
  }
  if (payload.type === "trustroots.location.invite.v1") {
    setStatus("Invite received.");
  }
  if (payload.type === "trustroots.location.stop.v1") {
    const current = state.peers.get(event.pubkey);
    if (current?.sessionId === payload.sessionId) state.peers.delete(event.pubkey);
    setStatus("A peer stopped sharing.");
  }
  render();
}

function renderSigner() {
  setText("signer-status", state.signer.text);
  setText("signer-short", state.signer.status === "full" ? shortValue(state.signer.pubkey) : "Signer unavailable");
  byId("signer-status")?.classList.toggle("connected", state.signer.status === "full");
  byId("signer-dot")?.classList.toggle("good", state.signer.status === "full");
}

function renderSession() {
  const active = Boolean(state.session);
  const sessionText = active
    ? `Sharing until ${new Date(state.session.expiresAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "Not sharing";
  setText("session-status", sessionText);
  byId("session-dot")?.classList.toggle("good", active);
  byId("own-marker").hidden = !state.currentArea;
  setText("current-area", state.currentArea ? `${state.currentArea.area} approximate area` : "No location fix yet.");
  setText("map-label", state.currentArea ? `Current approximate area: ${state.currentArea.area}` : "Choose people, then share your approximate area.");
}

function renderRecipients() {
  const rows = [...state.recipients.values()];
  const html = rows.length
    ? rows.map((row) => `
      <div class="person-row">
        <span>${escapeHtml(row.display || row.input)}<small>${escapeHtml(row.status)}${row.pubkey ? ` - ${escapeHtml(shortValue(row.pubkey))}` : ""}</small></span>
        <button class="button" type="button" data-remove-recipient="${escapeHtml(row.pubkey || `failed:${row.input}`)}">Remove</button>
      </div>
    `).join("")
    : '<div class="empty">Add Trustroots usernames, NIP-05 handles, npubs, or public keys.</div>';
  const summary = rows.filter((row) => row.pubkey).length
    ? rows.filter((row) => row.pubkey).slice(0, 3).map((row) => row.display).join(", ") + (rows.filter((row) => row.pubkey).length > 3 ? ` +${rows.filter((row) => row.pubkey).length - 3} more` : "")
    : "";

  byId("recipient-list").innerHTML = html;
  byId("recipient-summary").innerHTML = summary
    ? `<div class="person-row"><span>${escapeHtml(summary)}<small>${selectedRecipientPubkeys().length} selected</small></span></div>`
    : '<div class="empty">Add Trustroots usernames, NIP-05 handles, npubs, or public keys.</div>';

  for (const button of byId("recipient-list").querySelectorAll("[data-remove-recipient]")) {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-remove-recipient");
      if (state.recipients.has(key)) state.recipients.delete(key);
      else {
        for (const [entryKey, row] of state.recipients.entries()) {
          if (`failed:${row.input}` === key) state.recipients.delete(entryKey);
        }
      }
      render();
    });
  }
}

function renderPeers() {
  const peers = [...state.peers.values()].filter((peer) => Number(peer.expiresAt) > nowSeconds());
  state.peers = new Map(peers.map((peer) => [peer.pubkey, peer]));
  byId("peer-list").innerHTML = peers.length
    ? peers.map((peer) => `
      <div class="person-row">
        <span>${escapeHtml(shortValue(peer.pubkey))}<small>${escapeHtml(peer.area)} received now</small></span>
      </div>
    `).join("")
    : '<div class="empty">No shared locations received yet.</div>';

  byId("peer-markers").innerHTML = peers.map((peer) => {
    const pos = markerPositionForPubkey(peer.pubkey);
    return `<div class="marker peer" data-label="${escapeHtml(shortValue(peer.pubkey, 4, 4))}" style="left:${pos.left}%;top:${pos.top}%"></div>`;
  }).join("");
}

function renderActions() {
  const hasSigner = state.signer.status === "full" && Boolean(state.signer.pubkey);
  const hasRecipients = selectedRecipientPubkeys().length > 0;
  const active = Boolean(state.session);
  const canStart = hasSigner && hasRecipients && !active && !state.busy;
  const canUpdate = hasSigner && hasRecipients && active && !state.busy;

  byId("share-action").disabled = !canStart;
  byId("sheet-share").disabled = !canStart && !canUpdate;
  byId("share-current-area").disabled = !canUpdate;
  byId("stop-sharing").disabled = !active || state.busy;
  byId("send-invite").disabled = !hasSigner || !hasRecipients || state.busy;
  byId("sheet-share").textContent = active ? "Share Current Area" : "Start Sharing";
}

function render() {
  if (!byId("nostrail-root")) return;
  renderSigner();
  renderSession();
  renderRecipients();
  renderPeers();
  renderActions();
}

function bindUi() {
  byId("open-recipient-sheet")?.addEventListener("click", () => {
    byId("recipient-sheet").hidden = false;
    setTimeout(() => byId("recipient-input")?.focus(), 0);
  });
  byId("sheet-close")?.addEventListener("click", () => {
    byId("recipient-sheet").hidden = true;
  });
  byId("recipient-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = byId("recipient-input");
    const values = splitRecipientInput(input?.value || "");
    if (!values.length) {
      setRecipientFeedback("Enter at least one person.", "error");
      return;
    }
    void addRecipientInputs(values);
    if (input) input.value = "";
  });
  byId("send-invite")?.addEventListener("click", () => void publishInvite());
  byId("share-action")?.addEventListener("click", () => void startSharing());
  byId("sheet-share")?.addEventListener("click", () => {
    if (state.session) void shareCurrentArea();
    else void startSharing();
  });
  byId("share-current-area")?.addEventListener("click", () => void shareCurrentArea());
  byId("stop-sharing")?.addEventListener("click", () => void stopSharing());
  document.addEventListener("visibilitychange", () => {
    if (state.session && document.visibilityState === "hidden") {
      setStatus("Sharing is paused while the page is hidden.");
    }
  });
}

export function initNostrailApp() {
  if (!byId("nostrail-root")) return;
  bindUi();
  render();
  watchForSigner();
  globalThis.window.NostrailWeb = {
    state,
    addRecipientInputs,
    consumeIncomingEvent,
    refreshSigner,
    startSharing,
    stopSharing,
  };
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNostrailApp);
  } else {
    initNostrailApp();
  }
}
