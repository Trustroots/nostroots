(function () {
  const ROOM_TAG = 'radiostr';
  const NIP42_KIND = 22242;
  const DEFAULT_RELAYS = ['wss://relay.guaka.org', 'wss://relay.trustroots.org', 'wss://nip42.trustroots.org'];
  const IDENTITY_KEY = 'radiostr:identity:v1';
  const SHARE_LISTENING_KEY = 'radiostr:share-listening:v1';
  const CHAT_CACHE_KEY = 'radiostr:chat-cache:v1';
  const NP_MIN_SECONDS = 10;
  const LISTENING_STALE_SECONDS = 2 * 60 * 60;
  const EXPIRATION_DAYS = 30;
  const CHAT_LIMIT = 200;
  const TEST_MODE = Boolean(window.__RADIOSTR_TEST__);

  const state = {
    relays: DEFAULT_RELAYS.slice(),
    stations: [],
    sections: [],
    stationById: new Map(),
    currentStationId: null,
    currentIndex: -1,
    playing: false,
    volume: 0.85,
    shareListening: true,
    identity: { ready: false, pubkey: null, secretKey: null, source: null },
    chatMessages: [],
    nowPlayingEvents: [],
    listeners: [],
    profiles: new Map(),
    seenEventIds: new Set(),
    npTimerId: 0,
    npStationAtStart: null,
    lastNpKey: '',
    lastNpAt: 0,
    relayStop: null
  };

  const els = {
    nowPlayingTitle: document.getElementById('now-playing-title'),
    nowPlayingArt: document.getElementById('now-playing-art'),
    playBtn: document.getElementById('play-btn'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    volume: document.getElementById('volume'),
    stationSections: document.getElementById('station-sections'),
    listenersList: document.getElementById('listeners-list'),
    listenersStatus: document.getElementById('listeners-status'),
    chatMessages: document.getElementById('chat-messages'),
    chatStatus: document.getElementById('chat-status'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    chatHint: document.getElementById('chat-hint'),
    shareListening: document.getElementById('share-listening'),
    identityActions: document.getElementById('identity-actions'),
    audio: document.getElementById('audio')
  };

  function tagValue(tags, name) {
    if (!Array.isArray(tags)) return '';
    const tag = tags.find((entry) => Array.isArray(entry) && entry[0] === name);
    return tag && tag[1] != null ? String(tag[1]) : '';
  }

  function hasTag(tags, name, value) {
    if (!Array.isArray(tags)) return false;
    return tags.some((entry) => Array.isArray(entry) && entry[0] === name && (value == null || entry[1] === value));
  }

  function titleFromStationId(id) {
    return String(id || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function somaStreamUrl(id) {
    return 'https://ice1.somafm.com/' + encodeURIComponent(String(id)) + '-128-mp3';
  }

  function stationArtDataUrl(id, station) {
    const title = String((station && station.title) || titleFromStationId(id) || 'Radio');
    const tags = Array.isArray(station && station.tags) ? station.tags : [];
    const initials = title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'RS';
    function svgBadge(opts) {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="' + opts.top + '"/>' +
        '<stop offset="100%" stop-color="' + opts.bottom + '"/>' +
        '</linearGradient></defs>' +
        '<rect width="240" height="240" rx="36" fill="url(#g)"/>' +
        '<text x="120" y="138" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="68" font-weight="800">' +
        (opts.label || initials) +
        '</text></svg>';
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
    if (tags.includes('fip')) return svgBadge({ top: '#f5168c', bottom: '#4f2cff', label: 'FIP' });
    if (tags.includes('paradise')) return svgBadge({ top: '#00a0ff', bottom: '#0040c7', label: 'RP' });
    if (tags.includes('portugal')) return svgBadge({ top: '#006600', bottom: '#cc0000', label: 'PT' });
    return svgBadge({ top: '#2f855a', bottom: '#1a4d3a', label: initials });
  }

  function buildRadioData(rawChannels, rawSections) {
    const stationsInOrder = [];
    Object.entries(rawChannels || {}).forEach(([id, info]) => {
      const tags = Array.isArray(info.tags) ? info.tags.map(String) : [];
      const title = titleFromStationId(id);
      const fallbackImg = stationArtDataUrl(id, { title, tags });
      const url = info.url || (tags.includes('soma') ? somaStreamUrl(id) : '');
      if (!url) return;
      stationsInOrder.push({
        id,
        title,
        url,
        tags,
        site: info.site || '',
        img: info.img || fallbackImg,
        fallbackImg
      });
    });
    const sectionList = (rawSections || [])
      .slice()
      .sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999))
      .map((section) => {
        const tags = Array.isArray(section.tags) ? section.tags : [];
        const items = stationsInOrder.filter((station) => tags.some((tag) => station.tags.includes(tag)));
        return { name: section.name || 'Stations', items };
      })
      .filter((section) => section.items.length > 0);
    const seen = new Set();
    const flat = [];
    sectionList.forEach((section) => {
      section.items.forEach((station) => {
        if (seen.has(station.id)) return;
        seen.add(station.id);
        flat.push(station);
      });
    });
    stationsInOrder.forEach((station) => {
      if (seen.has(station.id)) return;
      seen.add(station.id);
      flat.push(station);
    });
    return { stations: flat, sections: sectionList };
  }

  function parseHashRoute(hash) {
    const raw = String(hash || '').replace(/^#/, '').trim();
    if (!raw) return { stationId: null };
    const stationId = raw.split(/[/?#]/)[0].trim();
    return { stationId: stationId || null };
  }

  function expirationTimestamp(nowMs) {
    return Math.floor((nowMs || Date.now()) / 1000) + EXPIRATION_DAYS * 24 * 60 * 60;
  }

  function buildExpirationTag(nowMs) {
    return ['expiration', String(expirationTimestamp(nowMs))];
  }

  function buildChatTags(stationId, nowMs) {
    const tags = [['t', ROOM_TAG], buildExpirationTag(nowMs)];
    if (stationId) tags.push(['channel', String(stationId)]);
    return tags;
  }

  function buildNowPlayingTags(stationId, nowMs) {
    return [
      ['t', ROOM_TAG],
      ['t', 'nowplaying'],
      ['radiostr_station', String(stationId)],
      ['client', 'radiostr'],
      buildExpirationTag(nowMs)
    ];
  }

  function isNowPlayingEvent(ev) {
    return hasTag(ev && ev.tags, 't', 'nowplaying') && hasTag(ev && ev.tags, 't', ROOM_TAG);
  }

  function isChatEvent(ev) {
    if (!ev || ev.kind !== 1) return false;
    if (!hasTag(ev.tags, 't', ROOM_TAG)) return false;
    return !hasTag(ev.tags, 't', 'nowplaying');
  }

  function parseNowPlayingEvent(ev) {
    if (!isNowPlayingEvent(ev)) return null;
    const stationId = tagValue(ev.tags, 'radiostr_station');
    if (!stationId) return null;
    return {
      pubkey: ev.pubkey,
      stationId,
      title: String(ev.content || '').trim(),
      createdAt: Number(ev.created_at) || 0,
      eventId: ev.id
    };
  }

  function aggregateListeners(events, nowSec) {
    const now = Number(nowSec) || Math.floor(Date.now() / 1000);
    const byPubkey = new Map();
    (events || []).forEach((ev) => {
      const parsed = parseNowPlayingEvent(ev);
      if (!parsed) return;
      if (now - parsed.createdAt > LISTENING_STALE_SECONDS) return;
      const prev = byPubkey.get(parsed.pubkey);
      if (!prev || parsed.createdAt > prev.createdAt) {
        byPubkey.set(parsed.pubkey, parsed);
      }
    });
    return Array.from(byPubkey.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  function sinceThirtyDaysAgo() {
    return Math.floor(Date.now() / 1000) - EXPIRATION_DAYS * 24 * 60 * 60;
  }

  function shortPubkey(pubkey) {
    const hex = String(pubkey || '');
    return hex.length >= 12 ? hex.slice(0, 8) + '…' : hex || 'anon';
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatRelativeTime(createdAt) {
    const delta = Math.max(0, Math.floor(Date.now() / 1000) - Number(createdAt || 0));
    if (delta < 60) return 'just now';
    if (delta < 3600) return Math.floor(delta / 60) + 'm ago';
    if (delta < 86400) return Math.floor(delta / 3600) + 'h ago';
    return Math.floor(delta / 86400) + 'd ago';
  }

  function displayNameForPubkey(pubkey) {
    const profile = state.profiles.get(pubkey);
    if (profile && profile.display_name) return profile.display_name;
    if (profile && profile.name) return profile.name;
    return shortPubkey(pubkey);
  }

  function getStationById(id) {
    return state.stationById.get(String(id || '')) || null;
  }

  function stationIndex(id) {
    return state.stations.findIndex((station) => station.id === id);
  }

  function updateNowPlayingUi() {
    const station = getStationById(state.currentStationId);
    if (els.nowPlayingTitle) {
      els.nowPlayingTitle.textContent = station ? station.title : 'Pick a station';
    }
    if (els.nowPlayingArt) {
      const src = station ? (station.img || station.fallbackImg) : '';
      els.nowPlayingArt.src = src || '';
      els.nowPlayingArt.hidden = !src;
      els.nowPlayingArt.alt = station ? station.title + ' artwork' : '';
    }
    if (els.playBtn) {
      els.playBtn.textContent = state.playing ? 'Pause' : 'Play';
      els.playBtn.setAttribute('aria-pressed', state.playing ? 'true' : 'false');
    }
  }

  function renderStationSections() {
    if (!els.stationSections) return;
    els.stationSections.replaceChildren();
    state.sections.forEach((section) => {
      const wrap = document.createElement('section');
      wrap.className = 'station-section';
      const heading = document.createElement('h3');
      heading.textContent = section.name;
      wrap.appendChild(heading);
      const grid = document.createElement('div');
      grid.className = 'station-grid';
      section.items.forEach((station) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'station-btn';
        if (station.id === state.currentStationId) btn.classList.add('active');
        btn.dataset.stationId = station.id;
        const img = document.createElement('img');
        img.src = station.img || station.fallbackImg;
        img.alt = '';
        img.loading = 'lazy';
        img.addEventListener('error', () => {
          img.src = station.fallbackImg;
        });
        const label = document.createElement('span');
        label.textContent = station.title;
        btn.append(img, label);
        btn.addEventListener('click', () => tuneIn(station.id));
        grid.appendChild(btn);
      });
      wrap.appendChild(grid);
      els.stationSections.appendChild(wrap);
    });
  }

  function renderListeners() {
    if (!els.listenersList) return;
    els.listenersList.replaceChildren();
    if (!state.listeners.length) {
      if (els.listenersStatus) {
        els.listenersStatus.textContent = 'Nobody has shared a station recently. Be the first!';
      }
      return;
    }
    if (els.listenersStatus) {
      els.listenersStatus.textContent = state.listeners.length + ' listener' + (state.listeners.length === 1 ? '' : 's');
    }
    state.listeners.forEach((entry) => {
      const station = getStationById(entry.stationId);
      const li = document.createElement('li');
      li.className = 'listener-item';
      const name = document.createElement('span');
      name.className = 'listener-name';
      name.textContent = displayNameForPubkey(entry.pubkey);
      const stationLabel = document.createElement('span');
      stationLabel.className = 'listener-station';
      stationLabel.textContent = station ? station.title : (entry.title || entry.stationId);
      const time = document.createElement('span');
      time.className = 'listener-time muted';
      time.textContent = formatRelativeTime(entry.createdAt);
      const tuneBtn = document.createElement('button');
      tuneBtn.type = 'button';
      tuneBtn.className = 'tune-btn';
      tuneBtn.textContent = 'Tune in';
      tuneBtn.addEventListener('click', () => tuneIn(entry.stationId));
      li.append(name, stationLabel, time, tuneBtn);
      els.listenersList.appendChild(li);
    });
  }

  function renderChat() {
    if (!els.chatMessages) return;
    els.chatMessages.replaceChildren();
    let prevPubkey = '';
    state.chatMessages.forEach((message) => {
      const row = document.createElement('div');
      row.className = 'chat-row';
      if (message.pubkey !== prevPubkey) row.classList.add('chat-row-new-user');
      prevPubkey = message.pubkey;
      const meta = document.createElement('div');
      meta.className = 'chat-meta';
      const user = document.createElement('span');
      user.className = 'chat-user';
      user.textContent = displayNameForPubkey(message.pubkey);
      const time = document.createElement('span');
      time.className = 'chat-time muted';
      time.textContent = formatRelativeTime(message.created_at);
      meta.append(user, time);
      const channelId = tagValue(message.tags, 'channel');
      if (channelId) {
        const channelBtn = document.createElement('button');
        channelBtn.type = 'button';
        channelBtn.className = 'channel-badge';
        const station = getStationById(channelId);
        channelBtn.textContent = station ? station.title : titleFromStationId(channelId);
        channelBtn.addEventListener('click', () => tuneIn(channelId));
        meta.appendChild(channelBtn);
      }
      const body = document.createElement('div');
      body.className = 'chat-body';
      body.textContent = String(message.content || '');
      row.append(meta, body);
      els.chatMessages.appendChild(row);
    });
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    if (els.chatStatus) {
      els.chatStatus.textContent = state.chatMessages.length
        ? state.chatMessages.length + ' recent messages'
        : 'Chat is quiet. Say hello!';
    }
  }

  function clearNowPlayingSchedule() {
    if (state.npTimerId) {
      clearTimeout(state.npTimerId);
      state.npTimerId = 0;
    }
    state.npStationAtStart = null;
  }

  function scheduleNowPlayingNote() {
    clearNowPlayingSchedule();
    if (!state.identity.ready || !state.shareListening || !state.currentStationId || !state.playing) return;
    const stationId = state.currentStationId;
    state.npStationAtStart = stationId;
    state.npTimerId = window.setTimeout(() => {
      state.npTimerId = 0;
      if (state.currentStationId !== stationId || !state.playing) return;
      void publishNowPlaying(stationId);
    }, NP_MIN_SECONDS * 1000);
  }

  async function getNostrTools() {
    if (!getNostrTools.promise) {
      getNostrTools.promise = import('https://cdn.jsdelivr.net/npm/nostr-tools@2.7.2/+esm');
    }
    return getNostrTools.promise;
  }

  async function signEventTemplate(template) {
    if (window.nostr && typeof window.nostr.signEvent === 'function') {
      return window.nostr.signEvent(template);
    }
    if (!state.identity.secretKey) throw new Error('No signer available');
    const tools = await getNostrTools();
    return tools.finalizeEvent(template, state.identity.secretKey);
  }

  async function publishToRelays(signed) {
    const payloads = state.relays.map((relay) => {
      return new Promise((resolve) => {
        let socket;
        let done = false;
        const finish = (ok) => {
          if (done) return;
          done = true;
          try {
            if (socket && socket.readyState === WebSocket.OPEN) socket.close();
          } catch (_) {}
          resolve(ok);
        };
        try {
          socket = new WebSocket(relay);
        } catch (_) {
          finish(false);
          return;
        }
        socket.addEventListener('open', () => {
          try {
            socket.send(JSON.stringify(['EVENT', signed]));
          } catch (_) {
            finish(false);
          }
        });
        socket.addEventListener('message', (message) => {
          let payload;
          try {
            payload = JSON.parse(message.data);
          } catch (_) {
            return;
          }
          if (payload[0] === 'OK' && payload[1] === signed.id) {
            finish(payload[2] === true);
          }
        });
        window.setTimeout(() => finish(false), 8000);
      });
    });
    const results = await Promise.all(payloads);
    if (!results.some(Boolean)) throw new Error('Relay publish failed');
  }

  async function publishChat(text) {
    const content = String(text || '').trim();
    if (!content) return;
    if (!state.identity.ready) throw new Error('Connect a key to chat');
    const template = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      content,
      tags: buildChatTags(state.currentStationId)
    };
    const signed = await signEventTemplate(template);
    await publishToRelays(signed);
    ingestEvent(signed, true);
  }

  async function publishNowPlaying(stationId) {
    const station = getStationById(stationId);
    if (!station || !state.identity.ready || !state.shareListening) return;
    const dedupKey = stationId;
    const now = Date.now();
    if (state.lastNpKey === dedupKey && now - state.lastNpAt < 10000) return;
    state.lastNpKey = dedupKey;
    state.lastNpAt = now;
    const template = {
      kind: 1,
      created_at: Math.floor(now / 1000),
      content: station.title,
      tags: buildNowPlayingTags(stationId, now)
    };
    const signed = await signEventTemplate(template);
    await publishToRelays(signed);
    ingestEvent(signed, true);
  }

  function loadChatCache() {
    try {
      const raw = localStorage.getItem(CHAT_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveChatCache() {
    try {
      localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(state.chatMessages.slice(-CHAT_LIMIT)));
    } catch (_) {}
  }

  function ingestEvent(ev, fromSelf) {
    if (!ev || !ev.id || state.seenEventIds.has(ev.id)) return;
    state.seenEventIds.add(ev.id);
    if (isChatEvent(ev)) {
      state.chatMessages.push(ev);
      state.chatMessages.sort((a, b) => Number(a.created_at) - Number(b.created_at));
      if (state.chatMessages.length > CHAT_LIMIT) {
        state.chatMessages = state.chatMessages.slice(-CHAT_LIMIT);
      }
      saveChatCache();
      renderChat();
      void fetchProfile(ev.pubkey);
    }
    if (isNowPlayingEvent(ev)) {
      const idx = state.nowPlayingEvents.findIndex((entry) => entry.id === ev.id);
      if (idx >= 0) state.nowPlayingEvents[idx] = ev;
      else state.nowPlayingEvents.push(ev);
      state.listeners = aggregateListeners(state.nowPlayingEvents);
      renderListeners();
      void fetchProfile(ev.pubkey);
    }
  }

  function relaySubscription(relays, filters, subID, onEvent) {
    const sockets = [];
    relays.forEach((relay, index) => {
      let socket;
      let requested = false;
      let authEventID = '';
      let done = false;
      const localSub = subID + '-' + index;

      function sendRequest() {
        if (requested || done || !socket || socket.readyState !== WebSocket.OPEN) return;
        requested = true;
        socket.send(JSON.stringify(['REQ', localSub, ...filters]));
      }

      async function authenticate(challenge) {
        if (!window.nostr || typeof window.nostr.signEvent !== 'function') {
          sendRequest();
          return;
        }
        try {
          const authEvent = await window.nostr.signEvent({
            kind: NIP42_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['relay', relay], ['challenge', String(challenge)]],
            content: ''
          });
          authEventID = authEvent.id || '';
          socket.send(JSON.stringify(['AUTH', authEvent]));
        } catch (_) {
          sendRequest();
        }
      }

      try {
        socket = new WebSocket(relay);
      } catch (_) {
        return;
      }
      sockets.push(socket);
      socket.addEventListener('open', () => {
        window.setTimeout(sendRequest, 400);
      });
      socket.addEventListener('message', async (message) => {
        let payload;
        try {
          payload = JSON.parse(message.data);
        } catch (_) {
          return;
        }
        const type = payload[0];
        if (type === 'AUTH') {
          await authenticate(payload[1]);
        } else if (type === 'OK' && payload[1] === authEventID && payload[2] === true) {
          requested = false;
          sendRequest();
        } else if (type === 'EVENT' && payload[1] === localSub) {
          onEvent(payload[2]);
        } else if (type === 'CLOSED' && payload[1] === localSub) {
          const reason = String(payload[2] || '');
          if (/auth-required|restricted/i.test(reason)) {
            requested = false;
            sendRequest();
          }
        }
      });
    });
    return () => {
      sockets.forEach((socket) => {
        try {
          if (socket.readyState === WebSocket.OPEN) socket.close();
        } catch (_) {}
      });
    };
  }

  async function fetchInitialEvents() {
    const since = sinceThirtyDaysAgo();
    const filters = [
      { kinds: [1], '#t': [ROOM_TAG], since, limit: CHAT_LIMIT },
      { kinds: [1], '#t': [ROOM_TAG, 'nowplaying'], since, limit: 100 }
    ];
    const events = [];
    for (const filter of filters) {
      const batch = await queryRelaysOnce(state.relays, filter);
      batch.forEach((ev) => events.push(ev));
    }
    const unique = new Map();
    events.forEach((ev) => {
      if (ev && ev.id) unique.set(ev.id, ev);
    });
    Array.from(unique.values()).forEach((ev) => ingestEvent(ev, false));
    state.nowPlayingEvents = Array.from(unique.values()).filter(isNowPlayingEvent);
    state.listeners = aggregateListeners(state.nowPlayingEvents);
    renderListeners();
  }

  function queryRelaysOnce(relays, filter) {
    return Promise.all(
      relays.map(
        (relay, index) =>
          new Promise((resolve) => {
            const events = [];
            let socket;
            let done = false;
            const subID = 'radiostr-init-' + index;
            const finish = () => {
              if (done) return;
              done = true;
              try {
                if (socket && socket.readyState === WebSocket.OPEN) socket.close();
              } catch (_) {}
              resolve(events);
            };
            try {
              socket = new WebSocket(relay);
            } catch (_) {
              finish();
              return;
            }
            socket.addEventListener('open', () => {
              socket.send(JSON.stringify(['REQ', subID, filter]));
            });
            socket.addEventListener('message', (message) => {
              let payload;
              try {
                payload = JSON.parse(message.data);
              } catch (_) {
                return;
              }
              if (payload[0] === 'EVENT' && payload[1] === subID) events.push(payload[2]);
              if (payload[0] === 'EOSE' && payload[1] === subID) finish();
            });
            socket.addEventListener('error', finish);
            socket.addEventListener('close', finish);
            window.setTimeout(finish, 12000);
          })
      )
    ).then((batches) => batches.flat());
  }

  function startLiveSubscriptions() {
    if (state.relayStop) state.relayStop();
    const since = sinceThirtyDaysAgo();
    state.relayStop = relaySubscription(
      state.relays,
      [{ kinds: [1], '#t': [ROOM_TAG], since }],
      'radiostr-live',
      (ev) => ingestEvent(ev, false)
    );
  }

  async function fetchProfile(pubkey) {
    if (!pubkey || state.profiles.has(pubkey)) return;
    const events = await queryRelaysOnce(state.relays, { kinds: [0], authors: [pubkey], limit: 1 });
    const ev = events[0];
    if (!ev) return;
    try {
      const meta = JSON.parse(ev.content || '{}');
      state.profiles.set(pubkey, meta);
      renderChat();
      renderListeners();
    } catch (_) {}
  }

  async function loadEphemeralIdentity() {
    try {
      const raw = localStorage.getItem(IDENTITY_KEY);
      if (!raw || !raw.startsWith('nsec')) return false;
      const tools = await getNostrTools();
      const decoded = tools.decode ? tools.decode(raw) : tools.nip19.decode(raw);
      const secretKey = decoded.data;
      const pubkey = tools.getPublicKey(secretKey);
      state.identity = { ready: true, pubkey, secretKey, source: 'local' };
      return true;
    } catch (_) {
      return false;
    }
  }

  async function generateEphemeralIdentity() {
    const tools = await getNostrTools();
    const secretKey = tools.generateSecretKey();
    const nsec = tools.nip19.nsecEncode(secretKey);
    localStorage.setItem(IDENTITY_KEY, nsec);
    state.identity = { ready: true, pubkey: tools.getPublicKey(secretKey), secretKey, source: 'local' };
    updateIdentityUi();
  }

  async function refreshNip07Identity() {
    if (!window.nostr || typeof window.nostr.getPublicKey !== 'function') return false;
    try {
      const pubkey = await window.nostr.getPublicKey();
      if (!pubkey) return false;
      state.identity = { ready: true, pubkey, secretKey: null, source: 'nip07' };
      return true;
    } catch (_) {
      return false;
    }
  }

  function updateIdentityUi() {
    const signedIn = state.identity.ready;
    if (els.chatInput) els.chatInput.disabled = !signedIn;
    if (els.chatForm) {
      const submit = els.chatForm.querySelector('button[type="submit"]');
      if (submit) submit.disabled = !signedIn;
    }
    if (els.shareListening) {
      els.shareListening.disabled = !signedIn;
      els.shareListening.checked = state.shareListening;
    }
    if (els.chatHint) {
      els.chatHint.textContent = signedIn
        ? 'You can chat and share what you are listening to.'
        : 'Connect a Nostr key to chat. You can still listen and read the room.';
    }
    if (els.identityActions) {
      els.identityActions.hidden = signedIn;
    }
  }

  function tuneIn(stationId, { updateHash = true } = {}) {
    const id = String(stationId || '');
    const station = getStationById(id);
    if (!station) return;
    state.currentStationId = id;
    state.currentIndex = stationIndex(id);
    if (updateHash && location.hash !== '#' + id) {
      location.hash = id;
    }
    renderStationSections();
    updateNowPlayingUi();
    if (els.audio) {
      els.audio.src = station.url;
      els.audio.volume = state.volume;
      const playPromise = els.audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          state.playing = false;
          updateNowPlayingUi();
        });
      }
      state.playing = true;
      updateNowPlayingUi();
      scheduleNowPlayingNote();
    }
  }

  function togglePlay() {
    if (!els.audio) return;
    if (!state.currentStationId) {
      if (state.stations.length) tuneIn(state.stations[0].id);
      return;
    }
    if (state.playing) {
      els.audio.pause();
      state.playing = false;
      clearNowPlayingSchedule();
    } else {
      const playPromise = els.audio.play();
      if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
      state.playing = true;
      scheduleNowPlayingNote();
    }
    updateNowPlayingUi();
  }

  function stepStation(delta) {
    if (!state.stations.length) return;
    let idx = state.currentIndex >= 0 ? state.currentIndex : 0;
    idx = (idx + delta + state.stations.length) % state.stations.length;
    tuneIn(state.stations[idx].id);
  }

  function applyHashRoute() {
    const { stationId } = parseHashRoute(location.hash);
    if (stationId && getStationById(stationId)) {
      tuneIn(stationId, { updateHash: false });
    }
  }

  function bindUi() {
    if (els.playBtn) els.playBtn.addEventListener('click', togglePlay);
    if (els.prevBtn) els.prevBtn.addEventListener('click', () => stepStation(-1));
    if (els.nextBtn) els.nextBtn.addEventListener('click', () => stepStation(1));
    if (els.volume) {
      els.volume.value = String(Math.round(state.volume * 100));
      els.volume.addEventListener('input', () => {
        state.volume = Number(els.volume.value) / 100;
        if (els.audio) els.audio.volume = state.volume;
      });
    }
    if (els.audio) {
      els.audio.addEventListener('play', () => {
        state.playing = true;
        updateNowPlayingUi();
        scheduleNowPlayingNote();
      });
      els.audio.addEventListener('pause', () => {
        state.playing = false;
        updateNowPlayingUi();
        clearNowPlayingSchedule();
      });
    }
    if (els.chatForm) {
      els.chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = els.chatInput ? els.chatInput.value : '';
        publishChat(text)
          .then(() => {
            if (els.chatInput) els.chatInput.value = '';
          })
          .catch((err) => {
            if (els.chatStatus) els.chatStatus.textContent = err.message || String(err);
          });
      });
    }
    if (els.shareListening) {
      els.shareListening.addEventListener('change', () => {
        state.shareListening = els.shareListening.checked;
        localStorage.setItem(SHARE_LISTENING_KEY, state.shareListening ? '1' : '0');
        if (state.shareListening && state.playing) scheduleNowPlayingNote();
        else clearNowPlayingSchedule();
      });
    }
    if (els.identityActions) {
      els.identityActions.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'generate-key') {
          generateEphemeralIdentity().catch(() => {});
        }
      });
    }
    document.addEventListener('keydown', (event) => {
      if (event.target && /input|textarea|select/i.test(event.target.tagName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      } else if (event.code === 'ArrowLeft') {
        stepStation(-1);
      } else if (event.code === 'ArrowRight') {
        stepStation(1);
      }
    });
    window.addEventListener('radiostr-somafm-artwork', () => {
      const built = buildRadioData(typeof channels !== 'undefined' ? channels : {}, typeof sections !== 'undefined' ? sections : []);
      state.stations = built.stations;
      state.sections = built.sections;
      state.stationById = new Map(state.stations.map((station) => [station.id, station]));
      renderStationSections();
      updateNowPlayingUi();
    });
  }

  async function initialize() {
    const built = buildRadioData(typeof channels !== 'undefined' ? channels : {}, typeof sections !== 'undefined' ? sections : []);
    state.stations = built.stations;
    state.sections = built.sections;
    state.stationById = new Map(state.stations.map((station) => [station.id, station]));
    state.shareListening = localStorage.getItem(SHARE_LISTENING_KEY) !== '0';
    state.chatMessages = loadChatCache();
    state.chatMessages.forEach((ev) => {
      if (ev && ev.id) state.seenEventIds.add(ev.id);
    });
    bindUi();
    renderStationSections();
    renderChat();
    updateNowPlayingUi();
    updateIdentityUi();
    await refreshNip07Identity();
    if (!state.identity.ready) await loadEphemeralIdentity();
    updateIdentityUi();
    applyHashRoute();
    renderListeners();
    try {
      await fetchInitialEvents();
    } catch (_) {}
    startLiveSubscriptions();
    window.setInterval(() => {
      state.listeners = aggregateListeners(state.nowPlayingEvents);
      renderListeners();
    }, 60000);
    if (window.nostr) {
      const poll = window.setInterval(async () => {
        if (state.identity.ready && state.identity.source === 'nip07') return;
        const ok = await refreshNip07Identity();
        if (ok) {
          window.clearInterval(poll);
          updateIdentityUi();
        }
      }, 1500);
      window.setTimeout(() => window.clearInterval(poll), 15000);
    }
  }

  const exports = {
    ROOM_TAG,
    DEFAULT_RELAYS,
    LISTENING_STALE_SECONDS,
    NP_MIN_SECONDS,
    tagValue,
    hasTag,
    titleFromStationId,
    somaStreamUrl,
    buildRadioData,
    parseHashRoute,
    buildExpirationTag,
    buildChatTags,
    buildNowPlayingTags,
    isNowPlayingEvent,
    isChatEvent,
    parseNowPlayingEvent,
    aggregateListeners,
    expirationTimestamp,
    state
  };

  window.Radiostr = Object.freeze(exports);

  if (!TEST_MODE) {
    window.addEventListener('hashchange', applyHashRoute);
    initialize();
  }
})();
