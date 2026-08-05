import {
  decodePlusCodeArea,
  encodePlusCode,
  isPinInsidePlusCode,
  plusCodePrecisionLabel,
} from './plus-code.js';
import {
  containsNsec,
  createFoodEventTemplate,
  foodEntryFromEvent,
} from './food-event.js?v=food-circle-20260804-1';
import {
  buildFoodEntryCommentTemplate,
  buildFoodChatEventTemplate,
  formatChatTime,
  isFoodEntryComment,
  isFoodChatEvent,
} from './food-chat.js?v=food-circle-20260804-1';

const STORAGE_KEY = 'nostroots_food_circle_entries_v1';
const CHAT_CACHE_KEY = 'nostroots_food_circle_chat_v1';
const CHAT_LIMIT = 200;
const FOOD_RELAYS = ['wss://relay.trustroots.org', 'wss://relay.nomadwiki.org'];
const LOCATION_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const locationSearchCache = new Map();
let lastLocationSearchAt = 0;
const TYPE_META = {
  popup: { icon: '🥡', label: 'Food pop-up' },
  fridge: { icon: '🧊', label: 'Community fridge' },
  dumpster: { icon: '♻️', label: 'Dumpster spot' },
  restaurant: { icon: '🍽️', label: 'Restaurant or café' },
  request: { icon: '🙋', label: 'Food wanted' },
};

const now = Date.now();
const SAMPLE_ENTRIES = [
  sample('sandwiches', 'popup', 'Sandwiches after a community event', 'About 20 vegetarian sandwiches. Use the side entrance and bring a container.', 'free', 52.5218, 13.4132, 8, 2),
  sample('fridge', 'fridge', 'Kiez community fridge', 'Public fridge and dry-food shelf. Please label anything you add.', 'free', 52.5087, 13.4541, 10, null),
  sample('bakery', 'restaurant', 'Yesterday’s bread at closing time', 'Ask kindly after 19:30. Availability changes each day.', 'free', 52.5312, 13.4007, 8, null),
  sample('dumpster', 'dumpster', 'Supermarket bakery bins', 'Usually bread and produce after closing. Leave the area cleaner than you found it.', 'free', 52.4947, 13.4293, 8, null, false),
  sample('request', 'request', 'Looking for a warm meal tonight', 'Anything vegetarian would help. I can collect around Neukölln.', 'free', 52.4818, 13.4358, 6, 5, false),
  sample('cafe', 'restaurant', 'Pay-what-you-can lunch', 'Daily vegetarian soup until it runs out.', 'donation', 52.5143, 13.3905, 10, 4),
];

function sample(id, type, title, details, cost, latitude, longitude, precision, expiresInHours, showPin = true) {
  return {
    id: `sample-${id}`,
    type,
    intent: type === 'request' ? 'request' : 'offer',
    title,
    details,
    cost,
    diet: type === 'popup' ? 'vegetarian' : '',
    plusCode: encodePlusCode(latitude, longitude, precision),
    precision,
    pin: showPin ? { latitude, longitude } : null,
    createdAt: now - 22 * 60 * 1000,
    expiresAt: expiresInHours ? now + expiresInHours * 60 * 60 * 1000 : null,
    confirmations: type === 'request' ? 0 : 2,
    sample: true,
  };
}

const state = {
  filter: 'all',
  freeOnly: true,
  entries: [...SAMPLE_ENTRIES, ...readEntries()],
  map: null,
  layers: [],
  draftLocation: null,
  selectedId: null,
  chatMessages: readChatCache(),
  chatProfiles: new Map(),
  chatProfileFetches: new Set(),
  chatSeenIds: new Set(),
  chatPubkey: '',
  chatUnread: 0,
  chatSubscribedAt: Math.floor(Date.now() / 1000),
  entryComments: new Map(),
  entryCommentSeenIds: new Set(),
  entryCommentSockets: [],
  activeCommentEventId: '',
};

const elements = {
  sidebar: document.querySelector('.sidebar'),
  list: document.getElementById('entry-list'),
  count: document.getElementById('result-count'),
  freeOnly: document.getElementById('free-only'),
  compose: document.getElementById('compose-dialog'),
  detail: document.getElementById('detail-dialog'),
  detailContent: document.getElementById('detail-content'),
  form: document.getElementById('entry-form'),
  type: document.getElementById('entry-type'),
  cost: document.getElementById('entry-cost'),
  details: document.getElementById('entry-details'),
  expiry: document.getElementById('entry-expiry'),
  diet: document.getElementById('entry-diet'),
  precision: document.getElementById('entry-precision'),
  pin: document.getElementById('show-pin'),
  locationSearch: document.getElementById('location-search'),
  locationSearchButton: document.getElementById('search-location'),
  locationSearchStatus: document.getElementById('location-search-status'),
  pinNote: document.getElementById('pin-note'),
  error: document.getElementById('form-error'),
  toast: document.getElementById('toast'),
  chat: document.getElementById('food-chat'),
  chatToggle: document.getElementById('chat-toggle'),
  chatUnread: document.getElementById('chat-unread'),
  chatMessages: document.getElementById('chat-messages'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  chatStatus: document.getElementById('chat-status'),
};

state.chatMessages.forEach((message) => {
  if (message?.id) state.chatSeenIds.add(message.id);
});

function readEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && entry.id && entry.plusCode) : [];
  } catch (_) {
    return [];
  }
}

function writeEntries() {
  const localEntries = state.entries.filter((entry) => !entry.sample);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(localEntries)); } catch (_) {}
}

function readChatCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_CACHE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isFoodChatEvent).slice(-CHAT_LIMIT) : [];
  } catch (_) {
    return [];
  }
}

function writeChatCache() {
  try { localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(state.chatMessages.slice(-CHAT_LIMIT))); } catch (_) {}
}

function visibleEntries() {
  const currentTime = Date.now();
  return state.entries
    .filter((entry) => !entry.expiresAt || entry.expiresAt > currentTime)
    .filter((entry) => state.filter === 'all' || entry.type === state.filter)
    .filter((entry) => !state.freeOnly || entry.cost === 'free')
    .sort((a, b) => {
      if (a.type === 'popup' && b.type !== 'popup') return -1;
      if (b.type === 'popup' && a.type !== 'popup') return 1;
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
}

function entryPosition(entry) {
  if (entry.pin) return { lat: entry.pin.latitude, lng: entry.pin.longitude };
  const area = decodePlusCodeArea(entry.plusCode);
  return area ? { lat: area.centerLat, lng: area.centerLng } : null;
}

function render() {
  const entries = visibleEntries();
  elements.count.textContent = `${entries.length} ${entries.length === 1 ? 'place' : 'places'}`;
  elements.list.replaceChildren();

  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<strong>Nothing matching nearby yet.</strong><br>Try another filter or add what you know.';
    elements.list.append(empty);
  }

  for (const entry of entries) elements.list.append(createEntryCard(entry));
  renderMap(entries);
}

function createEntryCard(entry) {
  const meta = TYPE_META[entry.type] || TYPE_META.popup;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'entry-card';
  button.innerHTML = `
    <span class="entry-icon" aria-hidden="true">${meta.icon}</span>
    <span class="entry-copy"><strong></strong><small></small></span>
    <span class="entry-meta"><span class="cost-badge"></span><span class="time-badge"></span></span>`;
  button.querySelector('.entry-copy strong').textContent = entry.title;
  button.querySelector('.entry-copy small').textContent = `${meta.label} · ${precisionText(entry)}`;
  button.querySelector('.cost-badge').textContent = costText(entry.cost);
  button.querySelector('.time-badge').textContent = timeText(entry);
  button.addEventListener('click', () => openDetail(entry.id));
  return button;
}

function renderMap(entries) {
  if (!state.map || !window.L) return;
  for (const layer of state.layers) layer.remove();
  state.layers = [];

  for (const entry of entries) {
    const position = entryPosition(entry);
    if (!position) continue;
    const meta = TYPE_META[entry.type] || TYPE_META.popup;
    let layer;
    if (entry.pin) {
      const icon = window.L.divIcon({
        className: '',
        html: `<div class="food-marker ${entry.type}"><span>${meta.icon}</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 34],
      });
      layer = window.L.marker([position.lat, position.lng], { icon, title: entry.title });
    } else {
      const area = decodePlusCodeArea(entry.plusCode);
      layer = window.L.rectangle([[area.south, area.west], [area.north, area.east]], {
        className: 'plus-area',
        color: entry.type === 'request' ? '#6d5ab0' : '#0b765f',
        fillColor: entry.type === 'request' ? '#8c78c9' : '#87a843',
        fillOpacity: 0.23,
        weight: 2,
      });
    }
    layer.addTo(state.map).on('click', () => openDetail(entry.id));
    layer.bindTooltip(entry.title, { direction: 'top', offset: [0, -8] });
    state.layers.push(layer);
  }
}

function initializeMap() {
  if (!window.L) {
    document.getElementById('map').textContent = 'The map could not load. You can still use the list.';
    return;
  }
  state.map = window.L.map('map', { zoomControl: false }).setView([52.515, 13.414], 12);
  window.L.control.zoom({ position: 'bottomright' }).addTo(state.map);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  }).addTo(state.map);
  state.map.on('click', ({ latlng }) => {
    if (!elements.compose.open) return;
    setDraftLocation(latlng.lat, latlng.lng, 'Pin selected on the map');
  });
}

function openCompose() {
  elements.form.reset();
  elements.error.textContent = '';
  elements.locationSearchStatus.textContent = '';
  state.draftLocation = null;
  updateLocationPreview();
  elements.compose.showModal();
  requestAnimationFrame(() => elements.details.focus());
}

function closeCompose() { elements.compose.close(); }

function setDraftLocation(latitude, longitude, message = '') {
  state.draftLocation = { latitude: Number(latitude), longitude: Number(longitude) };
  updateLocationPreview();
  if (message) showToast(message);
}

function updateLocationPreview() {
  const precision = Number(elements.precision.value);
  elements.pinNote.textContent = elements.pin.checked
    ? 'People will see the exact point on the map. Use this only for a pickup spot you are comfortable making public.'
    : `People will see only an approximate ${plusCodePrecisionLabel(precision).toLowerCase()} area.`;
}

function locate(onSuccess) {
  if (!navigator.geolocation) {
    showToast('Location is not available in this browser.');
    return;
  }
  showToast('Finding your location…');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => onSuccess(coords.latitude, coords.longitude),
    () => showToast('We could not access your location. Move the map instead.'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  );
}

async function searchLocation() {
  const query = elements.locationSearch.value.trim();
  if (!query) {
    elements.locationSearchStatus.textContent = 'Enter a street, neighborhood, or city.';
    elements.locationSearch.focus();
    return;
  }

  elements.locationSearchButton.disabled = true;
  elements.locationSearchButton.textContent = 'Searching…';
  elements.locationSearchStatus.textContent = 'Looking for that place…';
  try {
    const cacheKey = query.toLocaleLowerCase();
    let match = locationSearchCache.get(cacheKey);
    if (match === undefined) {
      const waitMs = Math.max(0, 1000 - (Date.now() - lastLocationSearchAt));
      if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
      lastLocationSearchAt = Date.now();
      const searchUrl = new URL(LOCATION_SEARCH_URL);
      searchUrl.searchParams.set('q', query);
      searchUrl.searchParams.set('format', 'jsonv2');
      searchUrl.searchParams.set('limit', '1');
      searchUrl.searchParams.set('addressdetails', '0');
      searchUrl.searchParams.set('accept-language', navigator.language || 'en');
      const response = await fetch(searchUrl, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Location search failed');
      const results = await response.json();
      match = Array.isArray(results) ? results[0] || null : null;
      locationSearchCache.set(cacheKey, match);
    }

    const latitude = Number(match?.lat);
    const longitude = Number(match?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      elements.locationSearchStatus.textContent = 'No matching place found. Try adding a city or country.';
      return;
    }
    const label = String(match.display_name || query);
    elements.locationSearchStatus.textContent = `Using ${label}`;
    setDraftLocation(latitude, longitude);
    state.map?.setView([latitude, longitude], 15);
  } catch (_) {
    elements.locationSearchStatus.textContent = 'Address search is unavailable. Try your location or the map center.';
  } finally {
    elements.locationSearchButton.disabled = false;
    elements.locationSearchButton.textContent = 'Use address';
  }
}

function splitEntryDetails(value) {
  const content = String(value || '').trim();
  const firstLine = content.split(/\r?\n/, 1)[0].trim();
  const title = (firstLine || content).slice(0, 72).trim();
  return { title, details: content.slice(title.length).trim() };
}

function submitEntry(event) {
  event.preventDefault();
  elements.error.textContent = '';
  const intent = 'offer';
  const location = state.draftLocation;
  const precision = Number(elements.precision.value);
  const plusCode = location ? encodePlusCode(location.latitude, location.longitude, precision) : '';
  const content = splitEntryDetails(elements.details.value);

  if (!content.title) {
    elements.error.textContent = 'Add details so people know what is available.';
    elements.details.focus();
    return;
  }
  if (containsNsec(elements.details.value)) {
    elements.error.textContent = 'Remove the nsec private key from this post. Private keys must never be shared.';
    return;
  }
  if (!location || !plusCode) {
    elements.error.textContent = 'Choose a location first.';
    return;
  }
  if (!isPinInsidePlusCode(plusCode, location.latitude, location.longitude)) {
    elements.error.textContent = 'The pin does not match its Plus Code. Choose the location again.';
    return;
  }

  const expiryValue = elements.expiry.value;
  const entry = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    intent,
    type: elements.type.value,
    title: content.title,
    details: content.details,
    cost: elements.cost.value,
    diet: elements.diet.value,
    plusCode,
    precision,
    pin: elements.pin.checked ? location : null,
    createdAt: Date.now(),
    expiresAt: expiryValue === 'permanent' ? null : Date.now() + Number(expiryValue) * 60 * 60 * 1000,
    confirmations: 0,
  };
  entry.eventTemplate = createFoodEventTemplate(entry);
  state.entries.push(entry);
  writeEntries();
  closeCompose();
  state.filter = 'all';
  syncFilterButtons();
  render();
  const position = entryPosition(entry);
  if (state.map && position) state.map.setView([position.lat, position.lng], entry.pin ? 16 : precision === 6 ? 9 : 13);
  showToast('Food shared with the circle.');
  track('nr_food_entry_added', { type: entry.type, precision, exact_pin: Boolean(entry.pin) });
  void publishEntryWhenPossible(entry);
}

async function publishEntryWhenPossible(entry) {
  const signer = window.nostr;
  if (!signer || typeof signer.signEvent !== 'function') return;
  try {
    const signedEvent = await signer.signEvent(entry.eventTemplate || createFoodEventTemplate(entry));
    if (!signedEvent?.id || !signedEvent?.sig) throw new Error('Signer returned an incomplete event');
    entry.eventId = signedEvent.id;
    entry.pubkey = signedEvent.pubkey || '';
    entry.published = true;
    writeEntries();
    const results = await Promise.allSettled(FOOD_RELAYS.map((relayUrl) => publishEventToRelay(relayUrl, signedEvent)));
    const accepted = results.filter((result) => result.status === 'fulfilled').length;
    showToast(accepted ? `Shared with Nostroots through ${accepted} ${accepted === 1 ? 'relay' : 'relays'}.` : 'Saved here, but relays did not accept it yet.');
  } catch (_) {
    showToast('Saved on this device. Nostr sharing was not approved.');
  }
}

function publishEventToRelay(relayUrl, event) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(relayUrl);
    const timeout = setTimeout(() => finish(new Error('Relay timed out')), 8000);
    let finished = false;
    function finish(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      try { socket.close(); } catch (_) {}
      if (error) reject(error);
      else resolve(relayUrl);
    }
    socket.addEventListener('open', () => socket.send(JSON.stringify(['EVENT', event])));
    socket.addEventListener('message', ({ data }) => {
      try {
        const message = JSON.parse(data);
        if (message[0] === 'OK' && message[1] === event.id) finish(message[2] ? null : new Error(message[3] || 'Rejected'));
      } catch (_) {}
    });
    socket.addEventListener('error', () => finish(new Error('Relay connection failed')));
  });
}

function initializeChat() {
  renderChat();
  state.chatMessages.forEach((message) => void fetchChatProfile(message.pubkey));
  elements.chatToggle.addEventListener('click', openChat);
  document.getElementById('chat-close').addEventListener('click', closeChat);
  elements.chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void sendChatMessage();
  });
  elements.chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      elements.chatForm.requestSubmit();
    }
  });
  void refreshChatSigner();
  const signerPoll = setInterval(() => {
    if (elements.chatInput.disabled) void refreshChatSigner();
    else clearInterval(signerPoll);
  }, 1500);
  setTimeout(() => clearInterval(signerPoll), 15000);
  subscribeToFoodCircleChat();
}

function openChat() {
  elements.chat.hidden = false;
  elements.chatToggle.hidden = true;
  elements.chatToggle.setAttribute('aria-expanded', 'true');
  state.chatUnread = 0;
  updateChatUnread();
  renderChat();
  setTimeout(() => elements.chatInput.disabled ? elements.chatMessages.focus?.() : elements.chatInput.focus(), 0);
}

function closeChat() {
  elements.chat.hidden = true;
  elements.chatToggle.hidden = false;
  elements.chatToggle.setAttribute('aria-expanded', 'false');
}

async function refreshChatSigner() {
  const signer = window.nostr;
  const available = Boolean(signer && typeof signer.signEvent === 'function');
  elements.chatInput.disabled = !available;
  elements.chatForm.querySelector('button[type="submit"]').disabled = !available;
  elements.chatStatus.textContent = available
    ? 'Messages are public and expire after 30 days.'
    : 'Connect a Nostr signer to join. You can still read.';
  if (available && typeof signer.getPublicKey === 'function') {
    try {
      state.chatPubkey = await signer.getPublicKey() || '';
      renderChat();
    } catch (_) {}
  }
}

function renderChat() {
  elements.chatMessages.replaceChildren();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const visible = state.chatMessages.filter((message) => {
    const expiration = Number((message.tags || []).find((tag) => tag[0] === 'expiration')?.[1] || 0);
    return !expiration || expiration > nowSeconds;
  });
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'chat-empty';
    empty.textContent = 'No messages yet. Start the #foodsharing conversation.';
    elements.chatMessages.append(empty);
    return;
  }
  for (const message of visible) {
    const row = document.createElement('article');
    row.className = `chat-message${message.pubkey && message.pubkey === state.chatPubkey ? ' own' : ''}`;
    const meta = document.createElement('div');
    meta.className = 'chat-message-meta';
    const author = document.createElement('strong');
    author.textContent = chatAuthorName(message.pubkey);
    const time = document.createElement('span');
    time.textContent = formatChatTime(message.created_at);
    const body = document.createElement('div');
    body.className = 'chat-message-body';
    body.textContent = String(message.content || '');
    meta.append(author, time);
    row.append(meta, body);
    elements.chatMessages.append(row);
  }
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function chatAuthorName(pubkey) {
  if (pubkey && pubkey === state.chatPubkey) return 'You';
  const profile = state.chatProfiles.get(pubkey);
  return profile?.label || (pubkey ? `${pubkey.slice(0, 8)}…` : 'Unknown');
}

function closeEntryCommentSubscription() {
  for (const socket of state.entryCommentSockets) {
    try { socket.close(); } catch (_) {}
  }
  state.entryCommentSockets = [];
  state.activeCommentEventId = '';
}

function subscribeToEntryComments(entry) {
  closeEntryCommentSubscription();
  renderEntryComments(entry);
  if (!entry.eventId || typeof WebSocket === 'undefined') return;
  state.activeCommentEventId = entry.eventId;
  FOOD_RELAYS.forEach((relayUrl, relayIndex) => {
    try {
      const socket = new WebSocket(relayUrl);
      const subscriptionId = `food-entry-chat-${relayIndex}-${Math.random().toString(36).slice(2, 8)}`;
      state.entryCommentSockets.push(socket);
      socket.addEventListener('open', () => socket.send(JSON.stringify(['REQ', subscriptionId, {
        kinds: [1111], '#E': [entry.eventId], limit: 100,
      }])));
      socket.addEventListener('message', ({ data }) => {
        try {
          const message = JSON.parse(data);
          if (message[0] === 'EVENT' && message[1] === subscriptionId) ingestEntryComment(message[2], entry.eventId);
        } catch (_) {}
      });
    } catch (_) {}
  });
}

function ingestEntryComment(event, rootEventId) {
  if (!isFoodEntryComment(event, rootEventId) || !event.id || state.entryCommentSeenIds.has(event.id)) return;
  state.entryCommentSeenIds.add(event.id);
  const comments = state.entryComments.get(rootEventId) || [];
  comments.push(event);
  comments.sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0));
  state.entryComments.set(rootEventId, comments.slice(-100));
  void fetchChatProfile(event.pubkey);
  const entry = state.entries.find((candidate) => candidate.eventId === rootEventId);
  if (entry && state.activeCommentEventId === rootEventId) renderEntryComments(entry);
}

function renderEntryComments(entry) {
  const container = elements.detailContent.querySelector('[data-entry-chat-messages]');
  const form = elements.detailContent.querySelector('[data-entry-chat-form]');
  const input = elements.detailContent.querySelector('[data-entry-chat-input]');
  const status = elements.detailContent.querySelector('[data-entry-chat-status]');
  if (!container || !form || !input || !status) return;
  container.replaceChildren();
  if (!entry.eventId) {
    const empty = document.createElement('p');
    empty.className = 'chat-empty';
    empty.textContent = entry.sample
      ? 'This example listing is not published, so it has no conversation.'
      : 'This listing must reach a Nostr relay before its conversation can start.';
    container.append(empty);
    input.disabled = true;
    form.querySelector('button').disabled = true;
    status.textContent = 'Published listings have their own public conversation.';
    return;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const comments = (state.entryComments.get(entry.eventId) || []).filter((comment) => {
    const expiration = Number((comment.tags || []).find((tag) => tag[0] === 'expiration')?.[1] || 0);
    return !expiration || expiration > nowSeconds;
  });
  if (!comments.length) {
    const empty = document.createElement('p');
    empty.className = 'chat-empty';
    empty.textContent = 'No messages yet. Ask about this listing.';
    container.append(empty);
  } else {
    for (const comment of comments) {
      const row = document.createElement('article');
      row.className = `chat-message${comment.pubkey && comment.pubkey === state.chatPubkey ? ' own' : ''}`;
      const meta = document.createElement('div');
      meta.className = 'chat-message-meta';
      const author = document.createElement('strong');
      author.textContent = chatAuthorName(comment.pubkey);
      const time = document.createElement('span');
      time.textContent = formatChatTime(comment.created_at);
      const body = document.createElement('div');
      body.className = 'chat-message-body';
      body.textContent = String(comment.content || '');
      meta.append(author, time);
      row.append(meta, body);
      container.append(row);
    }
    container.scrollTop = container.scrollHeight;
  }
  const available = Boolean(window.nostr && typeof window.nostr.signEvent === 'function');
  input.disabled = !available;
  form.querySelector('button').disabled = !available;
  status.textContent = available
    ? 'Messages are public and expire after 30 days.'
    : 'Connect a Nostr signer to join. You can still read.';
}

async function sendEntryComment(entry) {
  const form = elements.detailContent.querySelector('[data-entry-chat-form]');
  const input = elements.detailContent.querySelector('[data-entry-chat-input]');
  const status = elements.detailContent.querySelector('[data-entry-chat-status]');
  const content = input?.value.trim() || '';
  if (!form || !input || !status || !content) return;
  const signer = window.nostr;
  if (!signer || typeof signer.signEvent !== 'function') {
    status.textContent = 'Connect a Nostr signer before sending.';
    return;
  }
  const sendButton = form.querySelector('button');
  sendButton.disabled = true;
  status.textContent = 'Waiting for your signer…';
  try {
    const template = buildFoodEntryCommentTemplate(content, entry, FOOD_RELAYS[0]);
    const signed = await signer.signEvent(template);
    if (!signed?.id || !signed?.sig) throw new Error('The signer returned an incomplete message.');
    const results = await Promise.allSettled(FOOD_RELAYS.map((relayUrl) => publishEventToRelay(relayUrl, signed)));
    const accepted = results.filter((result) => result.status === 'fulfilled').length;
    if (!accepted) throw new Error('No relay accepted the message.');
    state.chatPubkey = signed.pubkey || state.chatPubkey;
    ingestEntryComment(signed, entry.eventId);
    input.value = '';
    status.textContent = `Sent through ${accepted} ${accepted === 1 ? 'relay' : 'relays'}.`;
    track('nr_food_entry_comment_sent', { relay_count: accepted });
  } catch (error) {
    status.textContent = error?.message || 'Message was not sent.';
  } finally {
    sendButton.disabled = !(window.nostr && typeof window.nostr.signEvent === 'function');
    input.focus();
  }
}

function ingestChatEvent(event) {
  if (!isFoodChatEvent(event) || !event.id || state.chatSeenIds.has(event.id)) return;
  state.chatSeenIds.add(event.id);
  state.chatMessages.push(event);
  state.chatMessages.sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0));
  if (state.chatMessages.length > CHAT_LIMIT) state.chatMessages = state.chatMessages.slice(-CHAT_LIMIT);
  writeChatCache();
  if (elements.chat.hidden && event.pubkey !== state.chatPubkey && Number(event.created_at || 0) >= state.chatSubscribedAt) {
    state.chatUnread += 1;
    updateChatUnread();
  }
  renderChat();
  void fetchChatProfile(event.pubkey);
}

function updateChatUnread() {
  elements.chatUnread.hidden = state.chatUnread === 0;
  elements.chatUnread.textContent = state.chatUnread > 99 ? '99+' : String(state.chatUnread);
}

async function sendChatMessage() {
  const content = elements.chatInput.value.trim();
  if (!content) return;
  const signer = window.nostr;
  if (!signer || typeof signer.signEvent !== 'function') {
    elements.chatStatus.textContent = 'Connect a Nostr signer before sending.';
    return;
  }
  elements.chatStatus.textContent = 'Waiting for your signer…';
  elements.chatForm.querySelector('button[type="submit"]').disabled = true;
  try {
    const template = buildFoodChatEventTemplate(content);
    const signed = await signer.signEvent(template);
    if (!signed?.id || !signed?.sig) throw new Error('The signer returned an incomplete message.');
    const results = await Promise.allSettled(FOOD_RELAYS.map((relayUrl) => publishEventToRelay(relayUrl, signed)));
    const accepted = results.filter((result) => result.status === 'fulfilled').length;
    if (!accepted) throw new Error('No relay accepted the message.');
    state.chatPubkey = signed.pubkey || state.chatPubkey;
    ingestChatEvent(signed);
    elements.chatInput.value = '';
    elements.chatStatus.textContent = `Sent through ${accepted} ${accepted === 1 ? 'relay' : 'relays'}.`;
    track('nr_food_chat_message_sent', { relay_count: accepted });
  } catch (error) {
    elements.chatStatus.textContent = error?.message || 'Message was not sent.';
  } finally {
    elements.chatForm.querySelector('button[type="submit"]').disabled = !(window.nostr && typeof window.nostr.signEvent === 'function');
    elements.chatInput.focus();
  }
}

function subscribeToFoodCircleChat() {
  if (typeof WebSocket === 'undefined') return;
  const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
  FOOD_RELAYS.forEach((relayUrl, relayIndex) => {
    try {
      const socket = new WebSocket(relayUrl);
      const subscriptionId = `food-chat-${relayIndex}-${Math.random().toString(36).slice(2, 8)}`;
      socket.addEventListener('open', () => socket.send(JSON.stringify(['REQ', subscriptionId, {
        kinds: [30397], '#l': ['foodsharing'], since, limit: CHAT_LIMIT,
      }])));
      socket.addEventListener('message', ({ data }) => {
        try {
          const message = JSON.parse(data);
          if (message[0] === 'EVENT' && message[1] === subscriptionId) ingestChatEvent(message[2]);
        } catch (_) {}
      });
    } catch (_) {}
  });
}

async function fetchChatProfile(pubkey) {
  if (!pubkey || state.chatProfiles.has(pubkey) || state.chatProfileFetches.has(pubkey)) return;
  if (state.chatProfiles.size + state.chatProfileFetches.size >= 40) return;
  state.chatProfileFetches.add(pubkey);
  const batches = await Promise.all(FOOD_RELAYS.map((relayUrl, index) => queryRelayOnce(relayUrl, {
    kinds: [0, 10390], authors: [pubkey], limit: 5,
  }, `food-profile-${index}-${pubkey.slice(0, 6)}`)));
  const events = batches.flat().sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
  let label = '';
  const trustrootsEvent = events.find((event) => event.kind === 10390);
  if (trustrootsEvent) {
    const username = (trustrootsEvent.tags || []).find((tag) => tag[0] === 'l' && tag[2] === 'org.trustroots:username')?.[1] || '';
    if (username) label = `${username}@trustroots.org`;
  }
  if (!label) {
    const metadata = events.find((event) => event.kind === 0);
    try {
      const profile = JSON.parse(metadata?.content || '{}');
      label = String(profile.nip05 || profile.display_name || profile.name || '').trim();
    } catch (_) {}
  }
  state.chatProfiles.set(pubkey, { label: label || `${pubkey.slice(0, 8)}…` });
  state.chatProfileFetches.delete(pubkey);
  renderChat();
  const activeEntry = state.entries.find((entry) => entry.eventId === state.activeCommentEventId);
  if (activeEntry) renderEntryComments(activeEntry);
}

function queryRelayOnce(relayUrl, filter, subscriptionId) {
  return new Promise((resolve) => {
    const events = [];
    let socket;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      try { socket?.close(); } catch (_) {}
      resolve(events);
    };
    const timeout = setTimeout(finish, 6000);
    try { socket = new WebSocket(relayUrl); } catch (_) { finish(); return; }
    socket.addEventListener('open', () => socket.send(JSON.stringify(['REQ', subscriptionId, filter])));
    socket.addEventListener('message', ({ data }) => {
      try {
        const message = JSON.parse(data);
        if (message[0] === 'EVENT' && message[1] === subscriptionId) events.push(message[2]);
        if (message[0] === 'EOSE' && message[1] === subscriptionId) finish();
      } catch (_) {}
    });
    socket.addEventListener('error', finish);
  });
}

function subscribeToFoodCircle() {
  if (typeof WebSocket === 'undefined') return;
  FOOD_RELAYS.forEach((relayUrl, relayIndex) => {
    try {
      const socket = new WebSocket(relayUrl);
      const subscriptionId = `food-circle-${relayIndex}-${Math.random().toString(36).slice(2, 8)}`;
      socket.addEventListener('open', () => {
        socket.send(JSON.stringify(['REQ', subscriptionId, {
          kinds: [30397, 30398],
          '#l': ['foodsharing'],
          limit: 250,
        }]));
      });
      socket.addEventListener('message', ({ data }) => {
        try {
          const message = JSON.parse(data);
          if (message[0] !== 'EVENT' || message[1] !== subscriptionId) return;
          const entry = foodEntryFromEvent(message[2]);
          if (entry) mergeRemoteEntry(entry);
        } catch (_) {}
      });
    } catch (_) {}
  });
}

function mergeRemoteEntry(entry) {
  const fingerprint = `${entry.plusCode}|${entry.createdAt}|${entry.title}|${entry.details}`;
  const duplicate = state.entries.some((candidate) =>
    (entry.eventId && candidate.eventId === entry.eventId) ||
    `${candidate.plusCode}|${candidate.createdAt}|${candidate.title}|${candidate.details}` === fingerprint
  );
  if (duplicate) return;
  state.entries.push(entry);
  render();
}

function openDetail(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  state.selectedId = id;
  const meta = TYPE_META[entry.type] || TYPE_META.popup;
  elements.detailContent.innerHTML = `
    <div class="detail-card">
      <div class="detail-top">
        <span class="detail-emoji" aria-hidden="true">${meta.icon}</span>
        <button class="icon-button" type="button" data-close-detail aria-label="Close">×</button>
      </div>
      <h2></h2>
      <p class="detail-description"></p>
      <ul class="detail-facts">
        <li><span>Type</span><strong>${meta.label}</strong></li>
        <li><span>Cost</span><strong>${costText(entry.cost)}</strong></li>
        <li><span>Status</span><strong>${timeText(entry)}</strong></li>
      </ul>
      <div class="detail-actions">
        <button class="primary-button" type="button" data-confirm>${entry.type === 'request' ? 'I can help' : 'Still there'}</button>
        <button class="secondary-button" type="button" data-map>Show on map</button>
        ${entry.sample ? '' : '<button class="secondary-button" type="button" data-remove>Remove</button>'}
      </div>
      <section class="entry-chat" aria-label="Listing conversation">
        <h3>Conversation</h3>
        <div class="chat-messages" data-entry-chat-messages aria-live="polite"></div>
        <form class="chat-form" data-entry-chat-form>
          <label class="sr-only" for="entry-chat-input">Message about this listing</label>
          <textarea id="entry-chat-input" data-entry-chat-input rows="1" maxlength="1000" placeholder="Ask about this listing"></textarea>
          <button type="submit" aria-label="Send message">Send</button>
        </form>
        <p class="chat-status" data-entry-chat-status></p>
      </section>
    </div>`;
  elements.detailContent.querySelector('h2').textContent = entry.title;
  elements.detailContent.querySelector('.detail-description').textContent = entry.details || 'No extra details were added.';
  elements.detailContent.querySelector('[data-close-detail]').addEventListener('click', () => elements.detail.close());
  elements.detailContent.querySelector('[data-confirm]').addEventListener('click', () => confirmEntry(entry));
  elements.detailContent.querySelector('[data-map]').addEventListener('click', () => focusEntry(entry));
  elements.detailContent.querySelector('[data-remove]')?.addEventListener('click', () => removeEntry(entry));
  const commentForm = elements.detailContent.querySelector('[data-entry-chat-form]');
  const commentInput = elements.detailContent.querySelector('[data-entry-chat-input]');
  commentForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void sendEntryComment(entry);
  });
  commentInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      commentForm.requestSubmit();
    }
  });
  elements.detail.showModal();
  subscribeToEntryComments(entry);
}

function confirmEntry(entry) {
  entry.confirmations = Number(entry.confirmations || 0) + 1;
  if (!entry.sample) writeEntries();
  elements.detail.close();
  showToast(entry.type === 'request' ? 'Thanks — reach out using your usual safe contact method.' : 'Thanks for confirming.');
}

function focusEntry(entry) {
  const position = entryPosition(entry);
  elements.detail.close();
  if (state.map && position) state.map.setView([position.lat, position.lng], entry.pin ? 16 : entry.precision === 6 ? 9 : 13);
  if (window.innerWidth <= 760) elements.sidebar.classList.add('list-hidden');
}

function removeEntry(entry) {
  state.entries = state.entries.filter((item) => item.id !== entry.id);
  writeEntries();
  elements.detail.close();
  render();
  showToast('Removed from Food Circle.');
}

function precisionText(entry) {
  return entry.pin ? 'Exact pin' : plusCodePrecisionLabel(entry.precision || decodePlusCodeArea(entry.plusCode)?.length || 8);
}

function costText(cost) {
  return ({ free: 'Free', donation: 'Pay what you can', discounted: 'Discounted' })[cost] || 'Free';
}

function timeText(entry) {
  if (!entry.expiresAt) return 'Ongoing';
  const minutes = Math.max(0, Math.round((entry.expiresAt - Date.now()) / 60000));
  if (minutes < 60) return `${minutes} min left`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} hr left`;
  return `${Math.round(minutes / 1440)} days left`;
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 2600);
}

function syncFilterButtons() {
  document.querySelectorAll('[data-filter]').forEach((button) => button.classList.toggle('active', button.dataset.filter === state.filter));
}

function track(name, data = {}) {
  try { window.NrVibeAnalytics?.track(name, { surface: 'food-circle', ...data }); } catch (_) {}
}

document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
  state.filter = button.dataset.filter;
  syncFilterButtons();
  render();
}));
elements.freeOnly.addEventListener('change', () => { state.freeOnly = elements.freeOnly.checked; render(); });
document.getElementById('share-food').addEventListener('click', openCompose);
document.querySelectorAll('[data-close-compose]').forEach((button) => button.addEventListener('click', closeCompose));
elements.precision.addEventListener('change', updateLocationPreview);
elements.pin.addEventListener('change', updateLocationPreview);
elements.form.addEventListener('submit', submitEntry);
document.getElementById('use-current-location').addEventListener('click', () => locate((lat, lng) => {
  setDraftLocation(lat, lng, 'Using your current location');
  state.map?.setView([lat, lng], 15);
}));
elements.locationSearchButton.addEventListener('click', () => void searchLocation());
elements.locationSearch.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  void searchLocation();
});
document.getElementById('use-map-center').addEventListener('click', () => {
  const center = state.map?.getCenter() || { lat: 52.515, lng: 13.414 };
  setDraftLocation(center.lat, center.lng, 'Using the center of the map');
});
document.getElementById('locate-me').addEventListener('click', () => locate((lat, lng) => {
  state.map?.setView([lat, lng], 14);
  showToast('Map centered on your location');
}));
document.getElementById('open-list').addEventListener('click', () => elements.sidebar.classList.toggle('list-hidden'));
elements.compose.addEventListener('click', (event) => { if (event.target === elements.compose) closeCompose(); });
elements.detail.addEventListener('click', (event) => { if (event.target === elements.detail) elements.detail.close(); });
elements.detail.addEventListener('close', closeEntryCommentSubscription);

initializeMap();
render();
subscribeToFoodCircle();
initializeChat();
setInterval(render, 60000);
