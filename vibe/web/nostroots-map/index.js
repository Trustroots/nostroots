const MAP_CENTER = [24.94, 42.05];
const MAP_ZOOM = 2.2;
const SIGNER_DETECTION_TIMEOUT_MS = 12000;
const SIGNER_DETECTION_INTERVAL_MS = 250;
const MAP_NOTE_KIND = 30397;
const MAP_NOTE_REPOST_KIND = 30398;
const DEFAULT_RELAYS = [
  "wss://relay.trustroots.org",
  "wss://relay.nomadwiki.org",
];
const RELAY_QUERY_LIMIT = 1500;
const DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH = 2;
const MAX_GRID_FEATURES = 1200;
const READ_STATUS_RENDER_DELAY_MS = 250;

const LAYERS = {
  trustroots: {
    title: "Trustroots",
    description: "Validated map notes",
    color: "#15803d",
    kinds: [MAP_NOTE_REPOST_KIND],
  },
  unverified: {
    title: "Unverified",
    description: "Signed traveler notes",
    color: "#d97706",
    kinds: [MAP_NOTE_KIND],
  },
  all: {
    title: "All notes",
    description: "Validated and unverified",
    color: "#12a585",
    kinds: [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND],
  },
};

const MINUTE_IN_SECONDS = 60;
const HOUR_IN_SECONDS = 60 * MINUTE_IN_SECONDS;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;
const WEEK_IN_SECONDS = 7 * DAY_IN_SECONDS;

const PLUS_CODE_ALPHABET = "23456789CFGHJMPQRVWX";
const GRID_SIZE = 20;
const PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125];
const LATITUDE_MAX = 90;
const LONGITUDE_MAX = 180;

const state = {
  signer: {
    connected: false,
    full: false,
    pubkey: "",
    text: "Checking signer...",
  },
  activeLayer: "trustroots",
  selectedPlusCode: "",
  selectedEventId: "",
  events: new Map(),
  relays: new Map(),
  map: null,
  renderer: "static",
  leafletGridLayer: null,
  gridUpdateFrame: 0,
  readStatusTimer: 0,
};

const rectangleCache = new Map();

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortHex(value, head = 8, tail = 6) {
  const text = String(value || "");
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function setText(id, text) {
  const el = byId(id);
  if (el) el.textContent = text;
}

function closeLayerMenu() {
  const menu = byId("layer-menu");
  if (menu) menu.hidden = true;
  byId("layer-toggle")?.setAttribute("aria-expanded", "false");
}

function setRendererStatus(text) {
  setText("map-renderer-status", text);
}

function setComposeFeedback(text, tone = "") {
  const el = byId("compose-feedback");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", tone === "error");
  el.classList.toggle("success", tone === "success");
}

function updateSignerUi() {
  setText("signer-status", state.signer.text);
  setText("settings-signer", state.signer.text);
  byId("signer-status")?.classList.toggle("connected", state.signer.connected);
  const addNoteButton = byId("add-note-button");
  if (addNoteButton) {
    addNoteButton.disabled = !state.selectedPlusCode || !state.signer.connected;
  }
}

function getSignerStatus() {
  const provider = window.nostr;
  const hasProvider = provider && typeof provider.getPublicKey === "function";
  const hasSignEvent = hasProvider && typeof provider.signEvent === "function";
  const hasFullNostrootsBrowser =
    hasProvider &&
    provider.__nostrootsBrowser === true &&
    provider.nip44 &&
    typeof provider.nip44.encrypt === "function" &&
    typeof provider.nip44.decrypt === "function" &&
    provider.nip04 &&
    typeof provider.nip04.encrypt === "function" &&
    typeof provider.nip04.decrypt === "function";

  if (hasFullNostrootsBrowser) {
    return {
      connected: true,
      full: true,
      text: "Nostroots Browser signer connected.",
    };
  }

  if (hasSignEvent) {
    return {
      connected: true,
      full: false,
      text: "NIP-07 signer detected.",
    };
  }

  if (hasProvider) {
    return {
      connected: false,
      full: false,
      text: "NIP-07 signer can read keys, but cannot sign notes.",
    };
  }

  return {
    connected: false,
    full: false,
    text: "No NIP-07 signer detected. You can still read.",
  };
}

async function refreshSigner() {
  const result = getSignerStatus();
  let pubkey = "";
  if (result.connected) {
    try {
      pubkey = String(await window.nostr.getPublicKey()).trim().toLowerCase();
    } catch (_) {
      result.connected = false;
      result.text = "Signer detected, but public key was not available.";
    }
  }
  state.signer = { ...result, pubkey };
  updateSignerUi();
  return result.connected;
}

function watchForSigner() {
  const startedAt = Date.now();
  let timer = null;

  async function check() {
    const connected = await refreshSigner();
    if (connected || Date.now() - startedAt >= SIGNER_DETECTION_TIMEOUT_MS) {
      if (timer) clearInterval(timer);
      return;
    }
    state.signer.text = "Looking for a NIP-07 signer...";
    updateSignerUi();
  }

  void check();
  timer = setInterval(check, SIGNER_DETECTION_INTERVAL_MS);
  window.addEventListener("focus", () => void refreshSigner());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshSigner();
  });
}

function normalizeLongitude(lng) {
  let next = Number(lng);
  while (next > LONGITUDE_MAX) next -= 360;
  while (next < -LONGITUDE_MAX) next += 360;
  return next;
}

function encodePlusCode(latitude, longitude, codeLength = 8) {
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
    const resolution = i < PAIR_RESOLUTIONS.length
      ? PAIR_RESOLUTIONS[i]
      : PAIR_RESOLUTIONS[PAIR_RESOLUTIONS.length - 1] /
        Math.pow(GRID_SIZE, i - PAIR_RESOLUTIONS.length + 1);

    const latDigit = Math.min(PLUS_CODE_ALPHABET.length - 1, Math.floor(lat / resolution));
    const lngDigit = Math.min(PLUS_CODE_ALPHABET.length - 1, Math.floor(lng / resolution));
    code += PLUS_CODE_ALPHABET[latDigit];
    code += PLUS_CODE_ALPHABET[lngDigit];
    lat -= latDigit * resolution;
    lng -= lngDigit * resolution;
  }

  if (code.length < 8) code = code.padEnd(8, "0");
  return `${code.substring(0, 8)}+${code.substring(8)}`.replace(/\+$/, "+");
}

function decodePlusCode(code) {
  if (!code || String(code).length < 2) return null;
  const cleanCode = String(code).replace("+", "").toUpperCase();
  let lat = -LATITUDE_MAX;
  let lng = -LONGITUDE_MAX;
  let lastResolution = 400;

  for (let i = 0; i < Math.min(cleanCode.length, 10); i += 2) {
    if (i + 1 >= cleanCode.length) break;
    const latChar = cleanCode[i];
    const lngChar = cleanCode[i + 1];
    if (latChar === "0" || lngChar === "0") break;
    const latIndex = PLUS_CODE_ALPHABET.indexOf(latChar);
    const lngIndex = PLUS_CODE_ALPHABET.indexOf(lngChar);
    if (latIndex === -1 || lngIndex === -1) return null;

    const pair = Math.floor(i / 2);
    const resolution = pair < PAIR_RESOLUTIONS.length
      ? PAIR_RESOLUTIONS[pair]
      : PAIR_RESOLUTIONS[PAIR_RESOLUTIONS.length - 1] /
        Math.pow(GRID_SIZE, pair - PAIR_RESOLUTIONS.length + 1);
    lastResolution = resolution;
    lat += latIndex * resolution;
    lng += lngIndex * resolution;
  }

  return {
    latitude: lat + lastResolution / 2,
    longitude: lng + lastResolution / 2,
  };
}

function significantPlusCodeLength(plusCode) {
  const clean = String(plusCode || "").replace("+", "").toUpperCase();
  const zeroIndex = clean.indexOf("0");
  return zeroIndex === -1 ? clean.length : zeroIndex;
}

function plusCodeToRectangle(plusCode) {
  const key = String(plusCode || "").toUpperCase();
  if (rectangleCache.has(key)) return rectangleCache.get(key);
  const decoded = decodePlusCode(key);
  if (!decoded) return null;

  const pairCount = Math.max(1, Math.floor(significantPlusCodeLength(key) / 2));
  const resolution = pairCount <= PAIR_RESOLUTIONS.length
    ? PAIR_RESOLUTIONS[pairCount - 1]
    : PAIR_RESOLUTIONS[PAIR_RESOLUTIONS.length - 1] /
      Math.pow(GRID_SIZE, pairCount - PAIR_RESOLUTIONS.length);
  const half = resolution / 2;
  const rectangle = [
    [decoded.longitude - half, decoded.latitude - half],
    [decoded.longitude + half, decoded.latitude - half],
    [decoded.longitude + half, decoded.latitude + half],
    [decoded.longitude - half, decoded.latitude + half],
    [decoded.longitude - half, decoded.latitude - half],
  ];

  if (rectangleCache.size > 10000) rectangleCache.clear();
  rectangleCache.set(key, rectangle);
  return rectangle;
}

function degreeSizeForPlusCodeLength(length) {
  if (length === 2) return 20.0;
  if (length === 4) return 1.0;
  if (length === 6) return 0.05;
  if (length === 8) return 0.0025;
  return 0.0025 / Math.pow(GRID_SIZE, (length - 8) / 2);
}

function whatLengthOfPlusCodeToShow(latitudeDelta, longitudeDelta = latitudeDelta * 2) {
  const maxCells = MAX_GRID_FEATURES * 0.82;
  const codeLengths = [
    { length: 8, cellSize: 0.0025 },
    { length: 6, cellSize: 0.05 },
    { length: 4, cellSize: 1.0 },
    { length: 2, cellSize: 20.0 },
  ];

  for (const { length, cellSize } of codeLengths) {
    const totalCells =
      (Math.ceil(Math.abs(latitudeDelta) / cellSize) + 1) *
      (Math.ceil(Math.abs(longitudeDelta) / cellSize) + 1);
    if (totalCells <= maxCells) return length;
  }
  return 2;
}

function getAllPlusCodesBetweenTwoPlusCodes(southWest, northEast, length) {
  const swDecoded = decodePlusCode(southWest);
  const neDecoded = decodePlusCode(northEast);
  if (!swDecoded || !neDecoded) return [];

  let latitudeDelta = neDecoded.latitude - swDecoded.latitude;
  let longitudeDelta = neDecoded.longitude - swDecoded.longitude;
  if (longitudeDelta < 0) longitudeDelta += 360;

  const degreesPerStep = degreeSizeForPlusCodeLength(length);
  const latitudeSteps = Math.max(1, Math.ceil(latitudeDelta / degreesPerStep) + 1);
  const longitudeSteps = Math.max(1, Math.ceil(longitudeDelta / degreesPerStep) + 1);
  const plusCodes = [];

  for (let latIndex = 0; latIndex < latitudeSteps; latIndex += 1) {
    for (let lngIndex = 0; lngIndex < longitudeSteps; lngIndex += 1) {
      const latitude = swDecoded.latitude + latIndex * degreesPerStep;
      const longitude = normalizeLongitude(swDecoded.longitude + lngIndex * degreesPerStep);
      const plusCode = encodePlusCode(latitude, longitude, length);
      if (plusCode) plusCodes.push(plusCode);
    }
  }

  return plusCodes;
}

function getPlusCodePrefixes(plusCode, minimumLength = DERIVED_EVENT_PLUS_CODE_PREFIX_MINIMUM_LENGTH) {
  const prefixes = [];
  const cleanCode = String(plusCode || "").split("+")[0];
  const maxLength = Math.min(8, cleanCode.length);
  for (let len = minimumLength; len <= maxLength; len += 2) {
    prefixes.push(`${cleanCode.substring(0, len).padEnd(8, "0")}+`);
  }
  return [...new Set(prefixes)];
}

function isPlusCodeInsidePlusCode(containingPlusCode, targetPlusCode) {
  const containing = String(containingPlusCode || "").replace("+", "").toUpperCase();
  const target = String(targetPlusCode || "").replace("+", "").toUpperCase();
  const zeroIndex = containing.indexOf("0");
  const prefix = zeroIndex === -1 ? containing : containing.slice(0, zeroIndex);
  return !!prefix && target.startsWith(prefix);
}

function getPlusCodeFromEvent(event) {
  const tags = Array.isArray(event?.tags) ? event.tags : [];
  const exact = tags.find((tag) =>
    Array.isArray(tag) &&
    tag[0] === "l" &&
    tag[1] &&
    String(tag[2] || "").toLowerCase() === "open-location-code"
  );
  if (exact) return String(exact[1]).trim().toUpperCase();
  const fallback = tags.find((tag) =>
    Array.isArray(tag) &&
    tag[0] === "l" &&
    typeof tag[1] === "string" &&
    tag[1].includes("+")
  );
  return fallback ? String(fallback[1]).trim().toUpperCase() : "";
}

function getEventExpiration(event) {
  const tag = (Array.isArray(event?.tags) ? event.tags : []).find((item) =>
    Array.isArray(item) && item[0] === "expiration" && item[1]
  );
  const value = Number(tag?.[1]);
  return Number.isFinite(value) ? value : 0;
}

function isEventExpired(event) {
  const expiration = getEventExpiration(event);
  return expiration > 0 && expiration <= Math.floor(Date.now() / 1000);
}

function getLayerForEvent(event) {
  if (event?.kind === MAP_NOTE_REPOST_KIND) return "trustroots";
  if (event?.kind === MAP_NOTE_KIND) return "unverified";
  return "";
}

function activeEvents() {
  const layer = LAYERS[state.activeLayer] || LAYERS.trustroots;
  return [...state.events.values()].filter((event) =>
    layer.kinds.includes(event.kind) &&
    getPlusCodeFromEvent(event) &&
    !isEventExpired(event)
  );
}

function eventCountForPlusCode(plusCode) {
  return activeEvents().filter((event) => {
    const eventPlusCode = getPlusCodeFromEvent(event);
    return eventPlusCode === plusCode || isPlusCodeInsidePlusCode(plusCode, eventPlusCode);
  }).length;
}

function filterEventsForPlusCode(plusCode) {
  const exact = [];
  const nearby = [];
  for (const event of activeEvents()) {
    const eventPlusCode = getPlusCodeFromEvent(event);
    if (eventPlusCode === plusCode) exact.push(event);
    else if (isPlusCodeInsidePlusCode(plusCode, eventPlusCode)) nearby.push(event);
  }
  exact.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  nearby.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return { exact, nearby };
}

function relativeTime(timestamp) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(timestamp || 0));
  if (seconds < MINUTE_IN_SECONDS) return "now";
  if (seconds < HOUR_IN_SECONDS) return `${Math.floor(seconds / MINUTE_IN_SECONDS)}m`;
  if (seconds < DAY_IN_SECONDS) return `${Math.floor(seconds / HOUR_IN_SECONDS)}h`;
  if (seconds < WEEK_IN_SECONDS * 8) return `${Math.floor(seconds / DAY_IN_SECONDS)}d`;
  return new Date(Number(timestamp || 0) * 1000).toISOString().slice(0, 10);
}

function expirationText(event) {
  const expiration = getEventExpiration(event);
  if (!expiration) return "";
  const remaining = expiration - Math.floor(Date.now() / 1000);
  if (remaining <= 0) return "";
  if (remaining < HOUR_IN_SECONDS) return `${Math.floor(remaining / MINUTE_IN_SECONDS)}m left`;
  if (remaining < DAY_IN_SECONDS) return `${Math.floor(remaining / HOUR_IN_SECONDS)}h left`;
  if (remaining < 365 * DAY_IN_SECONDS) return `${Math.floor(remaining / DAY_IN_SECONDS)}d left`;
  return `${Math.floor(remaining / (365 * DAY_IN_SECONDS))}yr left`;
}

function renderNote(event, isSelected) {
  const plusCode = getPlusCodeFromEvent(event);
  const layer = getLayerForEvent(event);
  const expiry = expirationText(event);
  const badgeClass = layer === "trustroots" ? "verified" : "unverified";
  const badgeText = layer === "trustroots" ? "validated" : "unverified";
  return `
    <button class="note-card${isSelected ? " selected" : ""}" type="button" data-event-id="${escapeHtml(event.id || "")}">
      <div class="note-meta">
        <span class="note-author">${escapeHtml(shortHex(event.pubkey || "anonymous"))} <span class="badge ${badgeClass}">${badgeText}</span></span>
        <span class="badge">${escapeHtml(plusCode)}</span>
      </div>
      <div class="note-content">${escapeHtml(event.content || "(empty note)")}</div>
      <div class="note-meta">
        <span>${escapeHtml(relativeTime(event.created_at))}</span>
        <span>${escapeHtml(expiry)}</span>
      </div>
    </button>
  `;
}

function renderNotes() {
  const host = byId("notes-list");
  if (!host) return;

  if (!state.selectedPlusCode) {
    host.innerHTML = '<div class="empty-state">Notes will appear here after you select a plus-code cell.</div>';
    setText("nostroots-map-title", "Map");
    setText("area-summary", "Tap the map to inspect an area.");
    setText("exact-count", "0");
    setText("nearby-count", "0");
    setText("visible-count", String(activeEvents().length));
    updateSignerUi();
    return;
  }

  const { exact, nearby } = filterEventsForPlusCode(state.selectedPlusCode);
  setText("nostroots-map-title", state.selectedPlusCode);
  setText(
    "area-summary",
    `${LAYERS[state.activeLayer].title} layer, ${exact.length} exact and ${nearby.length} nearby notes.`,
  );
  setText("exact-count", String(exact.length));
  setText("nearby-count", String(nearby.length));
  setText("visible-count", String(activeEvents().length));

  const sections = [];
  sections.push(`<h2 class="note-section-title">${exact.length} exact matches for ${escapeHtml(state.selectedPlusCode)}</h2>`);
  sections.push(
    exact.length
      ? exact.map((event) => renderNote(event, event.id === state.selectedEventId)).join("")
      : '<div class="empty-state">No exact notes for this cell yet.</div>',
  );
  sections.push(`<h2 class="note-section-title nearby">${nearby.length} within plus code ${escapeHtml(state.selectedPlusCode)}</h2>`);
  sections.push(
    nearby.length
      ? nearby.map((event) => renderNote(event, event.id === state.selectedEventId)).join("")
      : '<div class="empty-state">No child-cell notes in this area yet.</div>',
  );
  host.innerHTML = sections.join("");
  host.querySelectorAll(".note-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedEventId = button.dataset.eventId || "";
      renderNotes();
    });
  });
  updateSignerUi();
}

function renderRelayStatus() {
  const statuses = [...state.relays.values()];
  const connected = statuses.filter((item) => item.status === "connected").length;
  const notes = state.events.size;
  const text = connected > 0
    ? `${connected}/${DEFAULT_RELAYS.length} relays, ${notes} notes`
    : notes > 0
      ? `${notes} cached notes`
      : "Connecting to relays...";
  setText("relay-summary", text);
  setRendererStatus(`${state.renderer === "static" ? "Static map" : "Map ready"} - ${text}`);
  renderRelayList();
}

function scheduleReadStatusRender() {
  clearTimeout(state.readStatusTimer);
  state.readStatusTimer = setTimeout(renderRelayStatus, READ_STATUS_RENDER_DELAY_MS);
}

function renderRelayList() {
  const host = byId("relay-list");
  if (!host) return;
  host.innerHTML = DEFAULT_RELAYS.map((url) => {
    const item = state.relays.get(url) || { status: "idle", count: 0 };
    return `<div class="relay-chip">${escapeHtml(url)} - ${escapeHtml(item.status)} - ${item.count || 0} notes</div>`;
  }).join("");
}

function selectPlusCode(plusCode) {
  closeLayerMenu();
  state.selectedPlusCode = String(plusCode || "").toUpperCase();
  state.selectedEventId = "";
  renderNotes();
  updatePlusCodeGrid();
}

function getMapBounds() {
  const map = state.map;
  if (state.renderer === "maplibre" && map?.getBounds) {
    const bounds = map.getBounds();
    return {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    };
  }
  if (state.renderer === "leaflet" && map?.getBounds) {
    const bounds = map.getBounds();
    return {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    };
  }
  return { south: -60, west: -180, north: 80, east: 180 };
}

function pointToPlusCode(lat, lng) {
  const map = state.map;
  let length = 6;
  if (state.renderer === "maplibre" && map?.getBounds) {
    const bounds = getMapBounds();
    length = whatLengthOfPlusCodeToShow(bounds.north - bounds.south, bounds.east - bounds.west);
  } else if (state.renderer === "leaflet" && map?.getBounds) {
    const bounds = getMapBounds();
    length = whatLengthOfPlusCodeToShow(bounds.north - bounds.south, bounds.east - bounds.west);
  }
  return encodePlusCode(lat, lng, Math.max(4, length));
}

function gridFeaturesForCurrentView() {
  const bounds = getMapBounds();
  const latitudeDelta = bounds.north - bounds.south;
  const longitudeDelta = Math.min(360, Math.abs(bounds.east - bounds.west));
  const codeLength = whatLengthOfPlusCodeToShow(latitudeDelta, longitudeDelta);
  const sw = encodePlusCode(bounds.south, bounds.west, codeLength);
  const ne = encodePlusCode(bounds.north, bounds.east, codeLength);
  const visibleCodes = sw && ne ? getAllPlusCodesBetweenTwoPlusCodes(sw, ne, codeLength) : [];
  const eventCodes = new Set(activeEvents().map(getPlusCodeFromEvent).filter(Boolean));
  const allCodes = new Set([...visibleCodes, ...eventCodes]);
  if (state.selectedPlusCode) allCodes.add(state.selectedPlusCode);

  const features = [];
  for (const plusCode of allCodes) {
    if (features.length >= MAX_GRID_FEATURES) break;
    const rectangle = plusCodeToRectangle(plusCode);
    if (!rectangle) continue;
    const count = eventCountForPlusCode(plusCode);
    const selected = plusCode === state.selectedPlusCode;
    if (!selected && !visibleCodes.includes(plusCode) && count === 0) continue;
    const intensity = Math.min(1, count / 5);
    let fillColor = "rgba(60, 64, 74, 0.22)";
    if (selected) fillColor = "rgba(18, 165, 133, 0.66)";
    else if (count > 0) {
      const r = Math.round(217 - intensity * 59);
      const g = Math.round(119 + intensity * 9);
      const b = Math.round(6 + intensity * 51);
      fillColor = `rgba(${r}, ${g}, ${b}, 0.58)`;
    }
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [rectangle] },
      properties: {
        plusCode,
        eventCount: count,
        fillColor,
      },
    });
  }
  return features;
}

function pickMostSpecificPlusCodeFromFeatures(features) {
  let best = "";
  let bestLength = -1;
  for (const feature of features || []) {
    const plusCode = String(feature?.properties?.plusCode || "");
    const length = significantPlusCodeLength(plusCode);
    if (plusCode && length > bestLength) {
      best = plusCode;
      bestLength = length;
    }
  }
  return best;
}

function updateLeafletGrid() {
  if (!state.leafletGridLayer || !window.L) return;
  state.leafletGridLayer.clearLayers();
  for (const feature of gridFeaturesForCurrentView()) {
    const plusCode = feature.properties.plusCode;
    const latLngs = feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
    const polygon = window.L.polygon(latLngs, {
      color: "rgba(52, 64, 84, 0.56)",
      weight: 1,
      fillColor: feature.properties.fillColor,
      fillOpacity: 0.9,
    });
    polygon.on("click", () => selectPlusCode(plusCode));
    polygon.addTo(state.leafletGridLayer);
  }
}

function updatePlusCodeGrid() {
  if (state.gridUpdateFrame) cancelAnimationFrame(state.gridUpdateFrame);
  state.gridUpdateFrame = requestAnimationFrame(() => {
    state.gridUpdateFrame = 0;
    if (state.renderer === "leaflet") {
      updateLeafletGrid();
      return;
    }
    const map = state.map;
    if (state.renderer !== "maplibre" || !map?.getSource || !map.getSource("pluscode-grid")) return;
    map.getSource("pluscode-grid").setData({
      type: "FeatureCollection",
      features: gridFeaturesForCurrentView(),
    });
  });
}

function initMapLibre() {
  if (!window.maplibregl) return false;
  const map = new window.maplibregl.Map({
    container: "nostroots-map",
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "OpenStreetMap contributors",
        },
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }],
    },
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
  });

  map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.on("load", () => {
    state.map = map;
    state.renderer = "maplibre";
    setRendererStatus("Map ready");
    map.addSource("pluscode-grid", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "pluscode-grid-fill",
      type: "fill",
      source: "pluscode-grid",
      paint: {
        "fill-color": ["get", "fillColor"],
        "fill-opacity": 1,
      },
    });
    map.addLayer({
      id: "pluscode-grid-stroke",
      type: "line",
      source: "pluscode-grid",
      paint: {
        "line-color": "rgba(52, 64, 84, 0.5)",
        "line-width": 1,
      },
    });
    map.on("click", "pluscode-grid-fill", (event) => {
      const plusCode = pickMostSpecificPlusCodeFromFeatures(event.features);
      if (plusCode) selectPlusCode(plusCode);
    });
    map.on("mouseenter", "pluscode-grid-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "pluscode-grid-fill", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("click", (event) => {
      const features = map.queryRenderedFeatures(event.point, { layers: ["pluscode-grid-fill"] });
      if (features.length > 0) return;
      selectPlusCode(pointToPlusCode(event.lngLat.lat, event.lngLat.lng));
    });
    map.on("moveend", updatePlusCodeGrid);
    map.on("zoomend", updatePlusCodeGrid);
    updatePlusCodeGrid();
    renderRelayStatus();
  });

  window.__nostrootsMap = map;
  window.__nostrootsMapRenderer = "maplibre";
  return true;
}

function initLeaflet() {
  if (!window.L) return false;
  const map = window.L.map("nostroots-map", {
    center: [MAP_CENTER[1], MAP_CENTER[0]],
    zoom: MAP_ZOOM,
    zoomControl: false,
    worldCopyJump: true,
  });

  window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "OpenStreetMap contributors",
  }).addTo(map);
  window.L.control.zoom({ position: "bottomright" }).addTo(map);
  state.leafletGridLayer = window.L.layerGroup().addTo(map);
  map.on("click", (event) => {
    selectPlusCode(pointToPlusCode(event.latlng.lat, event.latlng.lng));
  });
  map.on("moveend", updatePlusCodeGrid);
  map.on("zoomend", updatePlusCodeGrid);
  state.map = map;
  state.renderer = "leaflet";
  window.__nostrootsMap = map;
  window.__nostrootsMapRenderer = "leaflet";
  setRendererStatus("Map ready");
  updatePlusCodeGrid();
  renderRelayStatus();
  return true;
}

function initStaticFallback() {
  state.renderer = "static";
  window.__nostrootsMapRenderer = "static";
  const container = byId("nostroots-map");
  if (container) {
    container.addEventListener("click", () => selectPlusCode("9G000000+"));
  }
  setRendererStatus("Map libraries unavailable; showing static fallback.");
  renderRelayStatus();
}

function centerMapOnCurrentLocation() {
  if (!navigator.geolocation) {
    setText("area-summary", "Location unavailable");
    return;
  }

  setText("area-summary", "Finding location...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const plusCode = pointToPlusCode(lat, lng);
      if (state.renderer === "maplibre" && state.map?.flyTo) {
        state.map.flyTo({ center: [lng, lat], zoom: Math.max(state.map.getZoom?.() || 3, 8) });
      } else if (state.renderer === "leaflet" && state.map?.setView) {
        state.map.setView([lat, lng], Math.max(state.map.getZoom?.() || 3, 8));
      }
      selectPlusCode(plusCode);
    },
    () => setText("area-summary", "Location unavailable"),
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
  );
}

function validIncomingEvent(event) {
  return event &&
    typeof event === "object" &&
    typeof event.id === "string" &&
    typeof event.pubkey === "string" &&
    [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND].includes(event.kind) &&
    Array.isArray(event.tags) &&
    getPlusCodeFromEvent(event);
}

function ingestEvent(event, relayUrl = "") {
  if (!validIncomingEvent(event)) return false;
  const existing = state.events.get(event.id);
  state.events.set(event.id, { ...event, _relayUrl: relayUrl || existing?._relayUrl || "" });
  renderNotes();
  updatePlusCodeGrid();
  return !existing;
}

function connectRelay(url) {
  if (!("WebSocket" in window)) {
    state.relays.set(url, { status: "unavailable", count: 0 });
    return;
  }

  state.relays.set(url, { status: "connecting", count: 0 });
  scheduleReadStatusRender();

  try {
    const ws = new WebSocket(url);
    const subId = `nostroots-map-${Math.random().toString(36).slice(2)}`;
    ws.addEventListener("open", () => {
      state.relays.set(url, { status: "connected", count: 0, ws });
      ws.send(JSON.stringify(["REQ", subId, { kinds: [MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND], limit: RELAY_QUERY_LIMIT }]));
      scheduleReadStatusRender();
    });
    ws.addEventListener("message", (message) => {
      let payload;
      try {
        payload = JSON.parse(message.data);
      } catch (_) {
        return;
      }
      if (Array.isArray(payload) && payload[0] === "EVENT" && payload[2]) {
        const added = ingestEvent(payload[2], url);
        if (added) {
          const current = state.relays.get(url) || {};
          state.relays.set(url, { ...current, status: "connected", count: (current.count || 0) + 1, ws });
          scheduleReadStatusRender();
        }
      }
      if (Array.isArray(payload) && payload[0] === "EOSE") {
        const current = state.relays.get(url) || {};
        state.relays.set(url, { ...current, status: "connected", eose: true, ws });
        scheduleReadStatusRender();
      }
    });
    ws.addEventListener("close", () => {
      const current = state.relays.get(url) || {};
      state.relays.set(url, { ...current, status: current.count ? "closed" : "closed empty" });
      scheduleReadStatusRender();
    });
    ws.addEventListener("error", () => {
      const current = state.relays.get(url) || {};
      state.relays.set(url, { ...current, status: "error" });
      scheduleReadStatusRender();
    });
  } catch (_) {
    state.relays.set(url, { status: "error", count: 0 });
    scheduleReadStatusRender();
  }
}

function connectRelays() {
  DEFAULT_RELAYS.forEach(connectRelay);
  renderRelayList();
}

async function publishToRelay(url, event) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok, message) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch (_) {}
      resolve({ ok, message });
    };
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (error) {
      resolve({ ok: false, message: error?.message || "connection failed" });
      return;
    }
    const timeout = setTimeout(() => finish(false, "timeout"), 9000);
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
      if (Array.isArray(payload) && payload[0] === "OK" && payload[1] === event.id) {
        clearTimeout(timeout);
        finish(Boolean(payload[2]), String(payload[3] || ""));
      }
    });
    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      finish(false, "relay error");
    });
    ws.addEventListener("close", () => {
      clearTimeout(timeout);
      finish(false, "closed");
    });
  });
}

async function publishNote() {
  if (!state.selectedPlusCode) {
    setComposeFeedback("Select an area on the map first.", "error");
    return;
  }
  if (!state.signer.connected || !window.nostr?.signEvent) {
    setComposeFeedback("Connect a NIP-07 signer before posting.", "error");
    return;
  }

  const textarea = byId("note-content");
  const content = String(textarea?.value || "").trim();
  if (content.length < 3) {
    setComposeFeedback("Note content must be at least 3 characters.", "error");
    return;
  }
  if (/\bnsec1[023456789acdefghjklmnpqrstuvwxyz]+\b/i.test(content)) {
    setComposeFeedback("Remove the private key from the note before posting.", "error");
    return;
  }

  setComposeFeedback("Signing note...");
  const expirationSeconds = Number(byId("note-expiry")?.value || WEEK_IN_SECONDS);
  const expiration = Math.floor(Date.now() / 1000) + expirationSeconds;
  const plusCode = state.selectedPlusCode;
  const tags = [
    ["expiration", String(expiration)],
    ["L", "open-location-code"],
    ["l", plusCode, "open-location-code"],
    ["L", "open-location-code-prefix"],
    ...getPlusCodePrefixes(plusCode).map((prefix) => ["l", prefix, "open-location-code-prefix"]),
  ];

  let signed;
  try {
    const pubkey = state.signer.pubkey || await window.nostr.getPublicKey();
    signed = await window.nostr.signEvent({
      kind: MAP_NOTE_KIND,
      content,
      created_at: Math.floor(Date.now() / 1000),
      pubkey,
      tags,
    });
  } catch (error) {
    setComposeFeedback(error?.message || "Signer rejected the note.", "error");
    return;
  }

  if (!signed?.id || !signed?.sig || !signed?.pubkey) {
    setComposeFeedback("Signer returned an incomplete event.", "error");
    return;
  }

  setComposeFeedback("Publishing to relays...");
  const results = await Promise.all(DEFAULT_RELAYS.map((url) => publishToRelay(url, signed)));
  const okCount = results.filter((result) => result.ok).length;
  ingestEvent(signed, okCount ? "local publish" : "local draft");

  if (okCount > 0) {
    setComposeFeedback(`Published to ${okCount}/${DEFAULT_RELAYS.length} relays.`, "success");
    if (textarea) textarea.value = "";
    setTimeout(closeComposeModal, 700);
  } else {
    setComposeFeedback("Signed locally, but no relay accepted it yet.", "error");
  }
}

function openComposeModal() {
  if (!state.selectedPlusCode) return;
  const modal = byId("compose-modal");
  if (!modal) return;
  modal.hidden = false;
  setComposeFeedback(state.signer.connected ? `Posting to ${state.selectedPlusCode}.` : "Connect a NIP-07 signer before posting.");
  setTimeout(() => byId("note-content")?.focus(), 0);
}

function closeComposeModal() {
  const modal = byId("compose-modal");
  if (modal) modal.hidden = true;
}

function openSettingsModal() {
  const modal = byId("settings-modal");
  if (modal) modal.hidden = false;
  renderRelayList();
  updateSignerUi();
}

function closeSettingsModal() {
  const modal = byId("settings-modal");
  if (modal) modal.hidden = true;
}

function renderLayerMenu() {
  const menu = byId("layer-menu");
  if (!menu) return;
  menu.innerHTML = Object.entries(LAYERS).map(([key, layer]) => `
    <button class="layer-option${key === state.activeLayer ? " active" : ""}" type="button" data-layer="${escapeHtml(key)}">
      <span class="layer-dot" style="background:${escapeHtml(layer.color)}"></span>
      <span>${escapeHtml(layer.title)}<br><small>${escapeHtml(layer.description)}</small></span>
      <span>${key === state.activeLayer ? "✓" : ""}</span>
    </button>
  `).join("");
  menu.querySelectorAll(".layer-option").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeLayer = button.dataset.layer || "trustroots";
      closeLayerMenu();
      renderLayerChrome();
      renderNotes();
      updatePlusCodeGrid();
    });
  });
}

function renderLayerChrome() {
  const layer = LAYERS[state.activeLayer] || LAYERS.trustroots;
  setText("active-layer-label", layer.title);
  const dot = byId("active-layer-dot");
  if (dot) dot.style.background = layer.color;
  renderLayerMenu();
}

function initControls() {
  document.querySelector(".map-stage")?.addEventListener("pointerdown", (event) => {
    if (event.target?.closest?.(".layer-picker")) return;
    closeLayerMenu();
  }, true);
  byId("location-button")?.addEventListener("click", centerMapOnCurrentLocation);
  byId("add-note-button")?.addEventListener("click", openComposeModal);
  byId("key-button")?.addEventListener("click", openSettingsModal);
  byId("settings-button")?.addEventListener("click", openSettingsModal);
  byId("close-compose")?.addEventListener("click", closeComposeModal);
  byId("cancel-compose")?.addEventListener("click", closeComposeModal);
  byId("publish-note")?.addEventListener("click", () => void publishNote());
  byId("close-settings")?.addEventListener("click", closeSettingsModal);
  byId("compose-modal")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeComposeModal();
  });
  byId("settings-modal")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeSettingsModal();
  });
  byId("layer-toggle")?.addEventListener("click", () => {
    const menu = byId("layer-menu");
    if (!menu) return;
    menu.hidden = !menu.hidden;
    byId("layer-toggle")?.setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeComposeModal();
      closeSettingsModal();
      closeLayerMenu();
    }
  });

  document.querySelectorAll(".nav-pill").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-pill").forEach((item) => {
        item.classList.remove("active");
        item.removeAttribute("aria-current");
      });
      button.classList.add("active");
      button.setAttribute("aria-current", "page");
      if (button.dataset.section === "list") {
        byId("notes-list")?.scrollIntoView({ block: "nearest" });
      }
    });
  });
}

function seedDemoNoteWhenEmpty() {
  setTimeout(() => {
    if (state.events.size > 0) return;
    const demo = {
      id: "demo-note-nostroots-map",
      kind: MAP_NOTE_KIND,
      pubkey: "demo".padEnd(64, "0"),
      created_at: Math.floor(Date.now() / 1000) - 3600,
      content: "Demo note while relays are still loading. Tap other cells or connect a signer to add your own.",
      tags: [
        ["expiration", String(Math.floor(Date.now() / 1000) + WEEK_IN_SECONDS)],
        ["L", "open-location-code"],
        ["l", "9G000000+", "open-location-code"],
      ],
      sig: "",
    };
    ingestEvent(demo, "demo");
    renderRelayStatus();
  }, 2500);
}

function initMap() {
  if (initMapLibre()) return;
  if (initLeaflet()) return;
  initStaticFallback();
}

function init() {
  renderLayerChrome();
  initControls();
  watchForSigner();
  initMap();
  connectRelays();
  renderNotes();
  seedDemoNoteWhenEmpty();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
