(function () {
  const ROOM_TAG = 'radiostr';
  const NIP42_KIND = 22242;
  const DEFAULT_RELAYS = ['wss://relay.trustroots.org', 'wss://relay.nomadwiki.org'];
  const CHAT_CACHE_KEY = 'radiostr:chat-cache:v1';
  const STARRED_STATIONS_KEY = 'radiostr:starred-stations:v1';
  const NP_MIN_SECONDS = 10;
  const NP_HEARTBEAT_SECONDS = 5 * 60;
  const LISTENING_STALE_SECONDS = 12 * 60;
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
    identity: { ready: false, pubkey: null, secretKey: null, source: null, nip05: '' },
    chatMessages: [],
    nowPlayingEvents: [],
    listeners: [],
    profiles: new Map(),
    seenEventIds: new Set(),
    npTimerId: 0,
    npStationAtStart: null,
    lastNpKey: '',
    lastNpAt: 0,
    relayStop: null,
    starredIds: [],
    chatWasEnabled: false
  };

  const els = {
    nowPlayingBar: document.getElementById('now-playing-bar'),
    nowPlayingTitle: document.getElementById('now-playing-title'),
    nowPlayingLabel: document.getElementById('now-playing-label-text'),
    nowPlayingSubtitle: document.getElementById('now-playing-subtitle'),
    nowPlayingArt: document.getElementById('now-playing-art'),
    playBtn: document.getElementById('play-btn'),
    starBtn: document.getElementById('star-btn'),
    stationSections: document.getElementById('station-sections'),
    listeningNowSection: document.getElementById('listening-now-section'),
    listenersList: document.getElementById('listeners-list'),
    chatMessages: document.getElementById('chat-messages'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    chatHint: document.getElementById('chat-hint'),
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
      const title = String(info.name || '').trim() || titleFromStationId(id);
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

  function buildFavoriteTags(station, action, nowMs) {
    const stationId = String((station && station.id) || station || '');
    const tags = [
      ['t', ROOM_TAG],
      ['t', 'favorite'],
      ['client', 'radiostr'],
      ['radiostr_station', stationId],
      ['radiostr_action', action === 'unstar' ? 'unstar' : 'star'],
      buildExpirationTag(nowMs)
    ];
    const title = String((station && station.title) || titleFromStationId(stationId) || '').trim();
    if (title) tags.push(['radiostr_title', title]);
    return tags;
  }

  function favoriteEventContent(station, starred) {
    const title = String((station && station.title) || titleFromStationId(station && station.id) || 'Station');
    return (starred ? '⭐ ' : '☆ ') + title + ' #radiostr #favorite';
  }

  function isFavoriteEvent(ev) {
    if (!ev || ev.kind !== 1) return false;
    return hasTag(ev.tags, 't', ROOM_TAG) && hasTag(ev.tags, 't', 'favorite');
  }

  function isNowPlayingEvent(ev) {
    return hasTag(ev && ev.tags, 't', 'nowplaying') && hasTag(ev && ev.tags, 't', ROOM_TAG);
  }

  function isChatEvent(ev) {
    if (!ev || ev.kind !== 1) return false;
    if (!hasTag(ev.tags, 't', ROOM_TAG)) return false;
    if (hasTag(ev.tags, 't', 'nowplaying')) return false;
    if (hasTag(ev.tags, 't', 'favorite')) return false;
    return true;
  }

  function parseFavoriteEvent(ev) {
    if (!isFavoriteEvent(ev)) return null;
    const stationId = tagValue(ev.tags, 'radiostr_station');
    if (!stationId) return null;
    const action = tagValue(ev.tags, 'radiostr_action');
    let starred = true;
    if (action === 'unstar') starred = false;
    else if (action === 'star') starred = true;
    else if (String(ev.content || '').trim().startsWith('☆')) starred = false;
    return {
      stationId,
      starred,
      createdAt: Number(ev.created_at) || 0
    };
  }

  function mergeFavoriteTimeline(events) {
    const timeline = (events || [])
      .map((ev) => parseFavoriteEvent(ev))
      .filter(Boolean)
      .sort((a, b) => a.createdAt - b.createdAt);
    const lastAction = new Map();
    const lastStarAt = new Map();
    timeline.forEach((entry) => {
      lastAction.set(entry.stationId, entry);
      if (entry.starred) lastStarAt.set(entry.stationId, entry.createdAt);
    });
    const starred = [];
    lastAction.forEach((entry, stationId) => {
      if (entry.starred) starred.push(stationId);
    });
    starred.sort((a, b) => (lastStarAt.get(b) || 0) - (lastStarAt.get(a) || 0));
    return starred;
  }

  function mergeStarredWithRemote(localIds, events) {
    const parsed = (events || []).map((ev) => parseFavoriteEvent(ev)).filter(Boolean);
    const remoteKnown = new Set(parsed.map((entry) => entry.stationId));
    const remoteStarred = mergeFavoriteTimeline(events);
    const merged = remoteStarred.slice();
    const seen = new Set(merged);
    (localIds || []).forEach((id) => {
      if (remoteKnown.has(id) || seen.has(id)) return;
      merged.push(id);
      seen.add(id);
    });
    return merged;
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
    if (profile) {
      if (profile.nip05) return profile.nip05;
      if (profile.pending) return '…';
      if (profile.label) return profile.label;
      if (profile.display_name) return profile.display_name;
      if (profile.name) return profile.name;
    }
    return '…';
  }

  function profileIdForPubkey(pubkey) {
    const profile = state.profiles.get(pubkey);
    if (!profile || profile.pending) return '';
    if (profile.nip05) return profile.nip05;
    if (profile.npub) return profile.npub;
    return pubkey;
  }

  function profilePageHref(profileId) {
    const id = String(profileId || '').trim();
    if (!id) return '';
    return '../../web/#profile/' + encodeURIComponent(id).replace(/%2B/g, '+');
  }

  function chatDisplayNameForPubkey(pubkey) {
    const profile = state.profiles.get(pubkey);
    if (!profile || profile.pending) return '…';
    return profile.nip05 || '';
  }

  function isTrustrootsChatAuthor(pubkey) {
    const profile = state.profiles.get(pubkey);
    if (!profile || profile.pending) return true;
    return !!profile.nip05;
  }

  function canChat() {
    return !!(state.identity.ready && state.identity.nip05);
  }

  function canShareListening() {
    return !!(state.identity.ready && state.identity.source === 'nip07');
  }

  function createSignAuthEvent(pubkey) {
    return async function (template, relayUrl) {
      const provider = window.nostr;
      const identity = window.RADIOSTR_IDENTITY;
      if (!provider?.signEvent || !identity) return null;
      const authTemplate = identity.normalizeRelayAuthTemplate(template, relayUrl);
      if (!authTemplate.pubkey) authTemplate.pubkey = pubkey;
      try {
        const signed = await provider.signEvent(authTemplate);
        return signed && String(signed.pubkey || '').toLowerCase() === String(pubkey).toLowerCase()
          ? signed
          : null;
      } catch (_) {
        return null;
      }
    };
  }

  function channelCatalog() {
    const rawChannels = typeof channels !== 'undefined'
      ? channels
      : (typeof window !== 'undefined' ? window.RADIOSTR_CHANNELS : null);
    const rawSections = typeof sections !== 'undefined'
      ? sections
      : (typeof window !== 'undefined' ? window.RADIOSTR_SECTIONS : null);
    return {
      channels: rawChannels && typeof rawChannels === 'object' ? rawChannels : {},
      sections: Array.isArray(rawSections) ? rawSections : []
    };
  }

  function loadStarredStationIds() {
    try {
      const raw = localStorage.getItem(STARRED_STATIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      const seen = new Set();
      return parsed
        .map((id) => String(id || '').trim())
        .filter((id) => {
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
    } catch (_) {
      return [];
    }
  }

  function saveStarredStationIds(ids) {
    try {
      localStorage.setItem(STARRED_STATIONS_KEY, JSON.stringify(ids));
    } catch (_) {}
  }

  function isStarred(stationId) {
    return state.starredIds.includes(String(stationId || ''));
  }

  function toggleStar(stationId) {
    const id = String(stationId || '');
    if (!id || !getStationById(id)) return;
    const nowStarred = !isStarred(id);
    if (nowStarred) {
      state.starredIds = state.starredIds.concat(id);
    } else {
      state.starredIds = state.starredIds.filter((entry) => entry !== id);
    }
    saveStarredStationIds(state.starredIds);
    renderStationSections();
    updateNowPlayingUi();
    if (canShareListening()) {
      void publishFavorite(id, nowStarred).catch(() => {});
    }
  }

  function starredStationsInOrder() {
    return state.starredIds
      .map((id) => getStationById(id))
      .filter(Boolean);
  }

  function updateStarButton(stationId) {
    if (!els.starBtn) return;
    const station = getStationById(stationId);
    if (!station) {
      els.starBtn.hidden = true;
      return;
    }
    els.starBtn.hidden = false;
    const starred = isStarred(station.id);
    els.starBtn.textContent = starred ? '★' : '☆';
    els.starBtn.setAttribute('aria-pressed', starred ? 'true' : 'false');
    els.starBtn.setAttribute('aria-label', starred ? 'Unstar ' + station.title : 'Star ' + station.title);
  }

  const STATION_PLAY_ICON = '<svg class="play-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  const STATION_PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';

  function stationTagsLabel(station) {
    return (station.tags || [])
      .map((tag) => String(tag || '').trim())
      .filter(Boolean)
      .join(' · ');
  }

  function createStationItem(station) {
    const row = document.createElement('div');
    row.className = 'station-row';
    row.dataset.stationId = station.id;
    if (station.id === state.currentStationId) row.classList.add('is-active');
    if (station.id === state.currentStationId && state.playing) row.classList.add('is-playing');

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'station-play';
    playBtn.setAttribute('aria-label', (state.currentStationId === station.id && state.playing)
      ? 'Pause ' + station.title
      : 'Play ' + station.title);
    playBtn.innerHTML = (state.currentStationId === station.id && state.playing)
      ? STATION_PAUSE_ICON
      : STATION_PLAY_ICON;
    playBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.currentStationId === station.id && state.playing) togglePlay();
      else tuneIn(station.id);
    });

    const mainBtn = document.createElement('button');
    mainBtn.type = 'button';
    mainBtn.className = 'station-row-main';
    mainBtn.setAttribute('aria-label', station.title);
    mainBtn.dataset.stationId = station.id;
    const img = document.createElement('img');
    img.className = 'station-art';
    img.src = station.img || station.fallbackImg;
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      img.src = station.fallbackImg;
    });
    const info = document.createElement('span');
    info.className = 'station-info';
    const name = document.createElement('span');
    name.className = 'station-name';
    name.textContent = station.title;
    info.appendChild(name);
    const tags = stationTagsLabel(station);
    if (tags) {
      const tagLine = document.createElement('span');
      tagLine.className = 'station-tags muted';
      tagLine.textContent = tags;
      info.appendChild(tagLine);
    }
    mainBtn.append(img, info);
    mainBtn.addEventListener('click', () => tuneIn(station.id));

    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    starBtn.className = 'station-star';
    const starred = isStarred(station.id);
    starBtn.textContent = starred ? '★' : '☆';
    starBtn.setAttribute('aria-pressed', starred ? 'true' : 'false');
    starBtn.setAttribute('aria-label', starred ? 'Unstar ' + station.title : 'Star ' + station.title);
    starBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleStar(station.id);
    });

    const liveBadge = document.createElement('span');
    liveBadge.className = 'station-live';
    liveBadge.textContent = 'LIVE';
    liveBadge.hidden = !(station.id === state.currentStationId && state.playing);

    row.append(playBtn, mainBtn, starBtn, liveBadge);
    return row;
  }

  function updateStationListState() {
    if (!els.stationSections) return;
    els.stationSections.querySelectorAll('.station-row').forEach((row) => {
      const id = row.dataset.stationId;
      const station = getStationById(id);
      const active = id === state.currentStationId;
      const playing = active && state.playing;
      row.classList.toggle('is-active', active);
      row.classList.toggle('is-playing', playing);
      const live = row.querySelector('.station-live');
      if (live) live.hidden = !playing;
      const playBtn = row.querySelector('.station-play');
      if (playBtn && station) {
        playBtn.innerHTML = playing ? STATION_PAUSE_ICON : STATION_PLAY_ICON;
        playBtn.setAttribute('aria-label', playing ? 'Pause ' + station.title : 'Play ' + station.title);
      }
      const mainBtn = row.querySelector('.station-row-main');
      if (mainBtn) mainBtn.classList.toggle('active', active);
    });
  }

  function appendStationSection(parent, name, stations) {
    if (!stations.length) return;
    const wrap = document.createElement('section');
    wrap.className = 'station-section';
    const head = document.createElement('div');
    head.className = 'station-section-head';
    const heading = document.createElement('h3');
    heading.textContent = name;
    const count = document.createElement('span');
    count.className = 'station-section-count muted';
    count.textContent = stations.length + ' station' + (stations.length === 1 ? '' : 's');
    head.append(heading, count);
    wrap.appendChild(head);
    const list = document.createElement('div');
    list.className = 'station-list';
    stations.forEach((station) => {
      list.appendChild(createStationItem(station));
    });
    wrap.appendChild(list);
    parent.appendChild(wrap);
  }

  function getStationById(id) {
    return state.stationById.get(String(id || '')) || null;
  }

  function stationIndex(id) {
    return state.stations.findIndex((station) => station.id === id);
  }

  function sectionNameForStation(stationId) {
    const id = String(stationId || '');
    for (let i = 0; i < state.sections.length; i += 1) {
      const section = state.sections[i];
      if (section.items.some((station) => station.id === id)) return section.name;
    }
    return '';
  }

  function updateNowPlayingUi() {
    const station = getStationById(state.currentStationId);
    const bar = els.nowPlayingBar;
    if (bar) {
      bar.classList.toggle('is-idle', !station);
      bar.classList.toggle('is-playing', !!(station && state.playing));
      bar.classList.toggle('has-station', !!station);
    }
    if (els.nowPlayingLabel) {
      if (!station) {
        els.nowPlayingLabel.textContent = 'Ready to listen';
      } else if (state.playing) {
        els.nowPlayingLabel.textContent = 'Now playing';
      } else {
        els.nowPlayingLabel.textContent = 'Paused';
      }
    }
    if (els.nowPlayingTitle) {
      els.nowPlayingTitle.textContent = station ? station.title : 'Pick a station';
    }
    if (els.nowPlayingSubtitle) {
      const sectionName = station ? sectionNameForStation(station.id) : '';
      if (sectionName) {
        els.nowPlayingSubtitle.textContent = sectionName;
        els.nowPlayingSubtitle.hidden = false;
      } else {
        els.nowPlayingSubtitle.textContent = '';
        els.nowPlayingSubtitle.hidden = true;
      }
    }
    if (els.nowPlayingArt) {
      const src = station ? (station.img || station.fallbackImg) : '';
      els.nowPlayingArt.src = src || '';
      els.nowPlayingArt.hidden = !src;
      els.nowPlayingArt.alt = station ? station.title + ' artwork' : '';
      if (bar) bar.classList.toggle('has-art', !!src);
    }
    if (els.playBtn) {
      els.playBtn.setAttribute('aria-pressed', state.playing ? 'true' : 'false');
      els.playBtn.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    }
    updateStarButton(state.currentStationId);
    updateStationListState();
  }

  function renderStationSections() {
    if (!els.stationSections) return;
    els.stationSections.replaceChildren();
    appendStationSection(els.stationSections, 'Starred', starredStationsInOrder());
    if (els.listeningNowSection) {
      els.stationSections.appendChild(els.listeningNowSection);
    }
    state.sections.forEach((section) => {
      appendStationSection(els.stationSections, section.name, section.items);
    });
  }

  function renderListeners() {
    if (!els.listenersList) return;
    els.listenersList.replaceChildren();
    state.listeners.forEach((entry) => {
      const station = getStationById(entry.stationId);
      const li = document.createElement('li');
      li.className = 'listener-item';
      const body = document.createElement('div');
      body.className = 'listener-body';
      const name = document.createElement('span');
      name.className = 'listener-name';
      const displayName = displayNameForPubkey(entry.pubkey);
      const profileHref = profilePageHref(profileIdForPubkey(entry.pubkey));
      if (profileHref) {
        const profileLink = document.createElement('a');
        profileLink.href = profileHref;
        profileLink.target = '_blank';
        profileLink.rel = 'noopener noreferrer';
        profileLink.textContent = displayName;
        name.appendChild(profileLink);
      } else {
        name.textContent = displayName;
      }
      const stationLabel = document.createElement('span');
      stationLabel.className = 'listener-station';
      const stationTitle = station ? station.title : (entry.title || entry.stationId);
      if (entry.stationId && getStationById(entry.stationId)) {
        const stationLink = document.createElement('a');
        stationLink.href = '#' + entry.stationId;
        stationLink.textContent = stationTitle;
        stationLabel.appendChild(stationLink);
      } else {
        stationLabel.textContent = stationTitle;
      }
      const time = document.createElement('span');
      time.className = 'listener-time muted';
      time.textContent = formatRelativeTime(entry.createdAt);
      body.append(name, stationLabel, time);

      if (station && (station.img || station.fallbackImg)) {
        const artWrap = document.createElement(entry.stationId ? 'a' : 'span');
        artWrap.className = entry.stationId ? 'listener-art-link' : 'listener-art-wrap';
        if (entry.stationId) artWrap.href = '#' + entry.stationId;
        const img = document.createElement('img');
        img.className = 'station-art listener-art';
        img.src = station.img || station.fallbackImg;
        img.alt = '';
        img.loading = 'lazy';
        img.addEventListener('error', () => {
          if (station.fallbackImg) img.src = station.fallbackImg;
        });
        artWrap.appendChild(img);
        li.append(artWrap, body);
      } else {
        li.appendChild(body);
      }
      els.listenersList.appendChild(li);
    });
  }

  function renderChat() {
    if (!els.chatMessages) return;
    els.chatMessages.replaceChildren();
    const visibleMessages = state.chatMessages.filter((message) => isTrustrootsChatAuthor(message.pubkey));
    let prevPubkey = '';
    visibleMessages.forEach((message) => {
      const displayName = chatDisplayNameForPubkey(message.pubkey);
      if (!displayName) return;
      const row = document.createElement('div');
      row.className = 'chat-row';
      if (message.pubkey !== prevPubkey) row.classList.add('chat-row-new-user');
      prevPubkey = message.pubkey;
      const meta = document.createElement('div');
      meta.className = 'chat-meta';
      const user = document.createElement('span');
      user.className = 'chat-user';
      user.textContent = displayName;
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
    if (!canShareListening() || !state.currentStationId || !state.playing) return;
    const stationId = state.currentStationId;
    state.npStationAtStart = stationId;

    function scheduleHeartbeat(delayMs) {
      state.npTimerId = window.setTimeout(() => {
        state.npTimerId = 0;
        if (state.currentStationId !== stationId || !state.playing) return;
        void publishNowPlaying(stationId).finally(() => {
          if (state.currentStationId !== stationId || !state.playing) return;
          scheduleHeartbeat(NP_HEARTBEAT_SECONDS * 1000);
        });
      }, delayMs);
    }

    scheduleHeartbeat(NP_MIN_SECONDS * 1000);
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

  async function publishFavorite(stationId, starred) {
    const station = getStationById(stationId);
    if (!station || !canShareListening()) return;
    const now = Date.now();
    const template = {
      kind: 1,
      created_at: Math.floor(now / 1000),
      content: favoriteEventContent(station, starred),
      tags: buildFavoriteTags(station, starred ? 'star' : 'unstar', now)
    };
    const signed = await signEventTemplate(template);
    await publishToRelays(signed);
  }

  async function syncFavoritesFromNostr() {
    if (!canShareListening() || !state.identity.pubkey) return;
    try {
      const events = await queryRelaysOnce(state.relays, {
        kinds: [1],
        authors: [state.identity.pubkey],
        '#t': [ROOM_TAG, 'favorite'],
        since: sinceThirtyDaysAgo(),
        limit: 500
      });
      state.starredIds = mergeStarredWithRemote(state.starredIds, events)
        .filter((id) => state.stationById.has(id));
      saveStarredStationIds(state.starredIds);
      renderStationSections();
      updateNowPlayingUi();
    } catch (_) {}
  }

  async function publishChat(text) {
    const content = String(text || '').trim();
    if (!content) return;
    if (!canChat()) {
      throw new Error(state.identity.ready
        ? 'Link your Trustroots NIP-05 to chat.'
        : 'Connect a Nostr extension with a Trustroots NIP-05 to chat.');
    }
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
    if (!station || !canShareListening()) return;
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

  function isBenignRelayError(reason) {
    const blob = String(reason && reason.message ? reason.message : reason || '');
    return /WebSocket|relay|connection (failed|closed|refused)|network|NS_ERROR|wss:/i.test(blob);
  }

  function attachSilentSocketHandlers(socket) {
    if (!socket) return;
    socket.addEventListener('error', () => {});
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
      attachSilentSocketHandlers(socket);
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
    if (!pubkey) return;
    const existing = state.profiles.get(pubkey);
    if (existing && !existing.pending) return;
    if (existing && existing.fetching) return;
    state.profiles.set(pubkey, { pending: true, fetching: true });
    renderChat();
    renderListeners();

    const identityApi = window.RADIOSTR_IDENTITY;
    if (identityApi && typeof identityApi.resolveDisplayIdentity === 'function') {
      const resolved = await identityApi.resolveDisplayIdentity(pubkey, createSignAuthEvent(pubkey));
      state.profiles.set(pubkey, resolved.nip05
        ? resolved
        : { nip05: '', noTrustroots: true, label: '' });
    } else {
      const events = await queryRelaysOnce(state.relays, { kinds: [0], authors: [pubkey], limit: 1 });
      const ev = events[0];
      let profile = { nip05: '', noTrustroots: true, label: '' };
      if (ev) {
        try {
          const meta = JSON.parse(ev.content || '{}');
          const nip05 = String(meta.nip05 || '').trim();
          if (nip05.endsWith('@trustroots.org')) {
            profile = {
              nip05,
              label: nip05,
              display_name: meta.display_name,
              name: meta.name
            };
          }
        } catch (_) {}
      }
      state.profiles.set(pubkey, profile);
    }
    renderChat();
    renderListeners();
  }

  async function resolveCurrentUserIdentity() {
    const pubkey = state.identity.pubkey;
    if (!pubkey) return;
    const identityApi = window.RADIOSTR_IDENTITY;
    if (!identityApi || typeof identityApi.resolveDisplayIdentity !== 'function') return;
    const signAuth = state.identity.source === 'nip07' ? createSignAuthEvent(pubkey) : null;
    const resolved = await identityApi.resolveDisplayIdentity(pubkey, signAuth);
    state.identity.nip05 = resolved.nip05 || '';
    state.profiles.set(pubkey, resolved.nip05
      ? resolved
      : { nip05: '', noTrustroots: true, label: '' });
    updateIdentityUi();
    renderChat();
    renderListeners();
  }

  async function refreshNip07Identity() {
    if (!window.nostr || typeof window.nostr.getPublicKey !== 'function') return false;
    try {
      const pubkey = await window.nostr.getPublicKey();
      if (!pubkey) return false;
      state.identity = { ready: true, pubkey, secretKey: null, source: 'nip07', nip05: '' };
      await resolveCurrentUserIdentity();
      return true;
    } catch (_) {
      return false;
    }
  }

  function focusChatInputIfEnabled() {
    if (!els.chatInput || els.chatInput.disabled || !canChat()) return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== els.chatInput) {
      if (/input|textarea|select/i.test(active.tagName)) return;
    }
    els.chatInput.focus();
  }

  function updateIdentityUi() {
    const signedIn = state.identity.ready;
    const chatEnabled = canChat();
    const chatJustEnabled = chatEnabled && !state.chatWasEnabled;
    state.chatWasEnabled = chatEnabled;
    if (els.chatInput) els.chatInput.disabled = !chatEnabled;
    if (els.chatForm) {
      const submit = els.chatForm.querySelector('button[type="submit"]');
      if (submit) submit.disabled = !chatEnabled;
    }
    if (els.chatHint) {
      if (chatEnabled) {
        els.chatHint.textContent = '';
      } else if (signedIn) {
        els.chatHint.textContent = 'Link your Trustroots identity (NIP-05) to chat.';
      } else {
        els.chatHint.textContent = 'Connect a Nostr extension with a Trustroots NIP-05 to chat. You can still listen and read the room.';
      }
    }
    if (chatJustEnabled) focusChatInputIfEnabled();
  }

  function waitForAudioReady(audio, timeoutMs) {
    const limit = Number(timeoutMs) > 0 ? Number(timeoutMs) : 12000;
    return new Promise((resolve, reject) => {
      if (!audio) {
        reject(new Error('no audio'));
        return;
      }
      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        resolve();
        return;
      }
      let timer = 0;
      const cleanup = () => {
        audio.removeEventListener('canplay', onReady);
        audio.removeEventListener('error', onError);
        if (timer) clearTimeout(timer);
      };
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('audio load error'));
      };
      timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('audio load timeout'));
      }, limit);
      audio.addEventListener('canplay', onReady, { once: true });
      audio.addEventListener('error', onError, { once: true });
    });
  }

  async function tryStartPlayback(stationUrl) {
    const audio = els.audio;
    const url = String(stationUrl || '');
    if (!audio || !url) return false;
    try {
      audio.src = url;
      audio.load();
      await waitForAudioReady(audio);
      await audio.play();
      return true;
    } catch (_) {
      return false;
    }
  }

  function tuneIn(stationId, { updateHash = true, autoplay = true } = {}) {
    const id = String(stationId || '');
    const station = getStationById(id);
    if (!station) return;
    state.currentStationId = id;
    state.currentIndex = stationIndex(id);
    if (updateHash && location.hash !== '#' + id) {
      location.hash = id;
    }
    renderStationSections();
    clearNowPlayingSchedule();
    if (els.audio) {
      els.audio.src = station.url;
    }
    if (autoplay && els.audio) {
      void tryStartPlayback(station.url).then((ok) => {
        if (state.currentStationId !== id) return;
        state.playing = ok;
        updateNowPlayingUi();
        if (ok) scheduleNowPlayingNote();
      });
    } else {
      state.playing = false;
    }
    updateNowPlayingUi();
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
      updateNowPlayingUi();
    } else {
      void tryStartPlayback(getStationById(state.currentStationId)?.url).then((ok) => {
        state.playing = ok;
        updateNowPlayingUi();
        if (ok) scheduleNowPlayingNote();
      });
    }
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
      tuneIn(stationId, { updateHash: false, autoplay: true });
    }
  }

  function prepareHashAutoplay() {
    const { stationId } = parseHashRoute(location.hash);
    if (!stationId || !getStationById(stationId) || !els.audio) return;
    els.audio.preload = 'auto';
  }

  function bindUi() {
    if (els.playBtn) els.playBtn.addEventListener('click', togglePlay);
    if (els.starBtn) {
      els.starBtn.addEventListener('click', () => {
        if (state.currentStationId) toggleStar(state.currentStationId);
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
            focusChatInputIfEnabled();
          })
          .catch((err) => {
            if (els.chatHint) els.chatHint.textContent = err.message || String(err);
          });
      });
    }
    document.addEventListener('keydown', (event) => {
      if (event.target && /input|textarea|select/i.test(event.target.tagName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      }
    });
    function refreshAfterRemoteArtwork() {
      const built = buildRadioData(channelCatalog().channels, channelCatalog().sections);
      state.stations = built.stations;
      state.sections = built.sections;
      state.stationById = new Map(state.stations.map((station) => [station.id, station]));
      state.starredIds = state.starredIds.filter((id) => state.stationById.has(id));
      saveStarredStationIds(state.starredIds);
      renderStationSections();
      renderListeners();
      updateNowPlayingUi();
    }
    window.addEventListener('radiostr-channel-artwork', refreshAfterRemoteArtwork);
    window.addEventListener('radiostr-somafm-artwork', refreshAfterRemoteArtwork);
  }

  async function initialize() {
    const built = buildRadioData(channelCatalog().channels, channelCatalog().sections);
    state.stations = built.stations;
    state.sections = built.sections;
    state.stationById = new Map(state.stations.map((station) => [station.id, station]));
    state.starredIds = loadStarredStationIds().filter((id) => state.stationById.has(id));
    saveStarredStationIds(state.starredIds);
    state.chatMessages = loadChatCache();
    state.chatMessages.forEach((ev) => {
      if (ev && ev.id) state.seenEventIds.add(ev.id);
    });
    bindUi();
    renderStationSections();
    renderChat();
    updateNowPlayingUi();
    prepareHashAutoplay();
    applyHashRoute();
    updateIdentityUi();
    await refreshNip07Identity();
    updateIdentityUi();
    await syncFavoritesFromNostr();
    state.chatMessages.forEach((ev) => {
      if (ev && ev.pubkey) void fetchProfile(ev.pubkey);
    });
    renderListeners();
    try {
      await fetchInitialEvents();
    } catch (_) {}
    startLiveSubscriptions();
    window.setInterval(() => {
      state.listeners = aggregateListeners(state.nowPlayingEvents);
      renderListeners();
    }, 30000);
    if (window.nostr) {
      const poll = window.setInterval(async () => {
        if (state.identity.ready && state.identity.source === 'nip07') return;
        const ok = await refreshNip07Identity();
        if (ok) {
          window.clearInterval(poll);
          await resolveCurrentUserIdentity();
          await syncFavoritesFromNostr();
          updateIdentityUi();
        }
      }, 1500);
      window.setTimeout(() => window.clearInterval(poll), 15000);
    }
  }

  function toggleStarredId(ids, stationId) {
    const id = String(stationId || '');
    if (!id) return ids.slice();
    if (ids.includes(id)) return ids.filter((entry) => entry !== id);
    return ids.concat(id);
  }

  function canChatFromIdentity(identity) {
    return !!(identity && identity.ready && identity.nip05);
  }

  function isTrustrootsChatAuthorForProfile(profile) {
    if (!profile || profile.pending) return true;
    return !!profile.nip05;
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
    buildFavoriteTags,
    favoriteEventContent,
    isNowPlayingEvent,
    isFavoriteEvent,
    isChatEvent,
    parseFavoriteEvent,
    mergeFavoriteTimeline,
    mergeStarredWithRemote,
    parseNowPlayingEvent,
    aggregateListeners,
    expirationTimestamp,
    toggleStarredId,
    canChatFromIdentity,
    isTrustrootsChatAuthorForProfile,
    profilePageHref,
    profileIdForPubkey,
    state
  };

  window.Radiostr = Object.freeze(exports);

  if (!TEST_MODE) {
    window.addEventListener('hashchange', applyHashRoute);
    initialize();
  }
})();
