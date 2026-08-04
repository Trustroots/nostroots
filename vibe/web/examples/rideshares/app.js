import { SimplePool, nip19, verifyEvent } from "https://cdn.jsdelivr.net/npm/nostr-tools@2.23.0/+esm";
import {
  decodeGeohashCenter,
  dedupeRideEvents,
  encodeGeohash,
  geohashPrefixes,
  matchRides,
  trustrootsProfileUrl,
} from "./core.js";

const RELAYS = [
  "wss://relay.trustroots.org",
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
];
const pool = new SimplePool();
const profileCache = new Map();
const state = {
  rides: [],
  visibleRides: [],
  searchType: "all",
  search: {},
  currentView: "list",
  userPubkey: "",
  map: null,
  markers: null,
  showingMine: false,
};

const elements = {
  list: document.querySelector("#journey-list"),
  map: document.querySelector("#journey-map"),
  empty: document.querySelector("#empty-state"),
  feedStatus: document.querySelector("#feed-status"),
  resultsSummary: document.querySelector("#results-summary"),
  searchForm: document.querySelector("#search-form"),
  searchOrigin: document.querySelector("#search-origin"),
  searchDestination: document.querySelector("#search-destination"),
  searchDate: document.querySelector("#search-date"),
  postDialog: document.querySelector("#post-dialog"),
  postForm: document.querySelector("#post-form"),
  postError: document.querySelector("#post-error"),
  publishButton: document.querySelector("#publish-button"),
  detailDialog: document.querySelector("#detail-dialog"),
  detailContent: document.querySelector("#detail-content"),
  aboutDialog: document.querySelector("#about-dialog"),
  toast: document.querySelector("#toast"),
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function safeImageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function shortKey(pubkey) {
  if (!pubkey) return "Traveller";
  try {
    const npub = nip19.npubEncode(pubkey);
    return `${npub.slice(0, 10)}…${npub.slice(-5)}`;
  } catch {
    return "Traveller";
  }
}

function formatDateRange(start, end) {
  if (!start) return "Flexible date";
  const formatter = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (!end || start.toDateString() === end.toDateString()) return formatter.format(start);
  const compact = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  return `${compact.format(start)} – ${compact.format(end)}`;
}

function formatRelativeDate(date) {
  if (!date) return "Flexible";
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return formatDateRange(date, date);
}

function profileFor(pubkey) {
  return profileCache.get(pubkey) || { name: shortKey(pubkey), picture: "", trustrootsVerified: false, loading: true };
}

function avatarMarkup(profile) {
  const picture = safeImageUrl(profile.picture);
  if (picture) return `<img class="avatar" src="${escapeHtml(picture)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`;
  const letter = String(profile.name || "T").trim().charAt(0).toUpperCase();
  return `<span class="avatar" aria-hidden="true">${escapeHtml(letter)}</span>`;
}

function travellerMarkup(profile, pubkey, detail = false) {
  const profileUrl = trustrootsProfileUrl(profile.nip05, profile.trustrootsVerified);
  const displayName = profileUrl ? profile.nip05 : (profile.name || shortKey(pubkey));
  const verification = profileUrl ? "✓ Verified Trustroots identity" : (detail ? "Nostr traveller" : "");
  const contents = `${avatarMarkup({ ...profile, name: displayName })}<span class="person-name"><strong>${escapeHtml(displayName)}</strong>${verification ? `<small>${escapeHtml(verification)}</small>` : ""}</span>`;
  if (!profileUrl) return `<span class="person${detail ? " detail-person" : ""}">${contents}</span>`;
  return `<a class="person person-link${detail ? " detail-person" : ""}" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(profile.nip05)} on Trustroots">${contents}</a>`;
}

function journeyCard(ride) {
  const profile = profileFor(ride.pubkey);
  const typeText = ride.type === "offer"
    ? "Lift offered"
    : ride.seekingDriver && ride.seekingCoHitchhiker
      ? "Seeking lift + company"
      : ride.seekingCoHitchhiker
        ? "Seeking co-hitchhiker"
        : "Looking for a lift";
  return `
    <article class="journey-card" tabindex="0" data-ride-id="${escapeHtml(ride.id)}" aria-label="${escapeHtml(typeText)} from ${escapeHtml(ride.origin)} to ${escapeHtml(ride.destination)}">
      <div class="journey-card-top">
        <span class="type-pill ${ride.type === "offer" ? "offer" : ""}">${typeText}</span>
        <span class="journey-date">${escapeHtml(formatDateRange(ride.departureStart, ride.departureEnd))}</span>
      </div>
      <div class="journey-route">
        <div class="route-place">${escapeHtml(ride.origin)}</div>
        <div class="route-place">${escapeHtml(ride.destination)}</div>
      </div>
      ${ride.via ? `<p class="journey-note"><strong>Via:</strong> ${escapeHtml(ride.via)}</p>` : ""}
      <p class="journey-note">${escapeHtml(ride.description || ride.summary || "Open to figuring out the route together.")}</p>
      <div class="journey-meta">
        ${travellerMarkup(profile, ride.pubkey)}
        <span class="card-arrow" aria-hidden="true">→</span>
      </div>
    </article>`;
}

function setFeedStatus(message = "", loading = false) {
  elements.feedStatus.hidden = !message;
  elements.feedStatus.innerHTML = message
    ? `${loading ? '<span class="spinner" aria-hidden="true"></span>' : ""}<span>${escapeHtml(message)}</span>`
    : "";
}

function applyFilters() {
  const base = state.showingMine ? state.rides.filter((ride) => ride.pubkey === state.userPubkey) : state.rides;
  state.visibleRides = matchRides(base, {
    ...state.search,
    type: state.searchType,
  });
  renderJourneys();
}

function renderJourneys() {
  const rides = state.visibleRides;
  elements.list.innerHTML = rides.map(journeyCard).join("");
  elements.empty.hidden = rides.length !== 0;
  elements.list.hidden = state.currentView !== "list" || rides.length === 0;
  elements.map.hidden = state.currentView !== "map" || rides.length === 0;
  setFeedStatus("");

  if (state.showingMine) {
    elements.resultsSummary.textContent = rides.length ? `${rides.length} active journey${rides.length === 1 ? "" : "s"} published by you.` : "Your active and upcoming posts will appear here.";
  } else if (state.search.origin || state.search.destination || state.search.date) {
    elements.resultsSummary.textContent = `${rides.length} journey${rides.length === 1 ? "" : "s"} matching this direction.`;
  } else {
    elements.resultsSummary.textContent = rides.length ? `${rides.length} fresh journey${rides.length === 1 ? "" : "s"} from the community.` : "Fresh posts from the community.";
  }

  if (state.currentView === "map" && rides.length) renderMap();
  void enrichProfiles(rides.slice(0, 24).map((ride) => ride.pubkey));
}

async function loadRides() {
  setFeedStatus("Listening for journeys…", true);
  const since = Math.floor(Date.now() / 1000) - 180 * 24 * 60 * 60;
  try {
    const batches = await Promise.all([
      pool.querySync(RELAYS, { kinds: [30402], "#t": ["rideshare"], since, limit: 500 }),
      pool.querySync(RELAYS, { kinds: [30402], "#t": ["travel-partner"], since, limit: 200 }),
    ]);
    state.rides = dedupeRideEvents(batches.flat());
    applyFilters();
    openJourneyFromUrl();
  } catch (error) {
    console.error(error);
    state.rides = [];
    applyFilters();
    setFeedStatus("The journey network is taking a breather. Try again in a moment.");
  }
}

async function enrichProfiles(pubkeys) {
  const missing = [...new Set(pubkeys)].filter((pubkey) => pubkey && !profileCache.has(pubkey));
  if (!missing.length) return;
  missing.forEach((pubkey) => profileCache.set(pubkey, { name: shortKey(pubkey), picture: "", trustrootsVerified: false, loading: true }));
  try {
    const eventBatches = await Promise.all([
      pool.querySync(RELAYS, { kinds: [0, 10390, 30390], authors: missing, limit: missing.length * 8 }),
      pool.querySync(RELAYS, { kinds: [30390], "#p": missing, limit: missing.length * 8 }),
    ]);
    const events = eventBatches.flat();
    const latestKind0 = new Map();
    for (const event of events) {
      if (event.kind !== 0) continue;
      const current = latestKind0.get(event.pubkey);
      if (!current || event.created_at > current.created_at) latestKind0.set(event.pubkey, event);
    }
    await Promise.all(missing.map(async (pubkey) => {
      let metadata = {};
      const event = latestKind0.get(pubkey);
      if (event) {
        try { metadata = JSON.parse(event.content || "{}"); } catch { metadata = {}; }
      }
      const trustrootsNip05 = trustrootsNip05ForPubkey(events, pubkey) || metadata.nip05;
      const name = metadata.display_name || metadata.displayName || metadata.name || shortKey(pubkey);
      const trustrootsVerified = await verifyTrustrootsNip05(trustrootsNip05, pubkey);
      profileCache.set(pubkey, {
        name: String(name).slice(0, 80),
        picture: safeImageUrl(metadata.picture),
        about: String(metadata.about || "").slice(0, 300),
        nip05: trustrootsNip05 || "",
        trustrootsVerified,
        loading: false,
      });
    }));
    elements.list.innerHTML = state.visibleRides.map(journeyCard).join("");
  } catch (error) {
    console.warn("Could not load traveller profiles", error);
    missing.forEach((pubkey) => profileCache.set(pubkey, { ...profileFor(pubkey), loading: false }));
  }
}

function trustrootsUsernameFromTags(tags) {
  for (const tag of tags || []) {
    if (tag?.[0] === "trustroots" && /^[a-z0-9_.-]+$/i.test(tag[1] || "")) return String(tag[1]).toLowerCase();
    if (tag?.[0] === "l" && tag?.[2] === "org.trustroots:username" && /^[a-z0-9_.-]+$/i.test(tag[1] || "")) return String(tag[1]).toLowerCase();
  }
  return "";
}

function trustrootsNip05ForPubkey(events, pubkey) {
  const relevant = (events || [])
    .filter((event) => event.pubkey === pubkey || event.tags?.some((tag) => tag?.[0] === "p" && tag?.[1] === pubkey))
    .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
  for (const event of relevant) {
    const username = trustrootsUsernameFromTags(event.tags);
    if (username) return `${username}@trustroots.org`;
    if (event.kind === 30390) {
      try {
        const content = JSON.parse(event.content || "{}");
        const candidate = content.nip05 || (content.trustrootsUsername ? `${content.trustrootsUsername}@trustroots.org` : "") || (content.username ? `${content.username}@trustroots.org` : "");
        if (/^[a-z0-9_.-]+@trustroots\.org$/i.test(candidate)) return candidate.toLowerCase();
      } catch {}
    }
  }
  return "";
}

async function verifyTrustrootsNip05(nip05, pubkey) {
  const value = String(nip05 || "").trim().toLowerCase();
  const match = value.match(/^([^@]+)@trustroots\.org$/);
  if (!match) return false;
  try {
    const response = await fetch(`https://trustroots.org/.well-known/nostr.json?name=${encodeURIComponent(match[1])}`, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) return false;
    const document = await response.json();
    return String(document?.names?.[match[1]] || "").toLowerCase() === pubkey.toLowerCase();
  } catch {
    return false;
  }
}

function areaLabel(result, fallback) {
  const address = result?.address || {};
  const locality = address.city || address.town || address.village || address.municipality || address.county || address.state;
  const region = locality === address.state ? "" : address.state;
  return [locality, region, address.country].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index).slice(0, 3).join(", ") || fallback;
}

async function geocodePlace(query) {
  const value = String(query || "").trim();
  if (!value) return null;
  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.search = new URLSearchParams({ q: value, format: "jsonv2", limit: "1", addressdetails: "1" });
  const response = await fetch(endpoint, { headers: { Accept: "application/json", "Accept-Language": navigator.language || "en" }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Place search failed");
  const [result] = await response.json();
  if (!result) throw new Error(`We could not find “${value}”. Try a nearby city or region.`);
  const coordinates = { lat: Number(result.lat), lon: Number(result.lon) };
  return { coordinates, label: areaLabel(result, value), geohash: encodeGeohash(coordinates.lat, coordinates.lon, 4) };
}

async function reverseGeocode(latitude, longitude) {
  const endpoint = new URL("https://nominatim.openstreetmap.org/reverse");
  endpoint.search = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: "jsonv2", zoom: "8", addressdetails: "1" });
  const response = await fetch(endpoint, { headers: { Accept: "application/json", "Accept-Language": navigator.language || "en" }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Area lookup failed");
  const result = await response.json();
  return areaLabel(result, "My area");
}

async function runSearch() {
  state.showingMine = false;
  const origin = elements.searchOrigin.value.trim();
  const destination = elements.searchDestination.value.trim();
  const date = elements.searchDate.value;
  const search = { origin, destination, date };
  const toGeocode = [];
  if (origin) toGeocode.push(geocodePlace(origin).then((result) => { search.originCoordinates = result.coordinates; search.origin = result.label; }).catch(() => {}));
  if (destination) toGeocode.push(geocodePlace(destination).then((result) => { search.destinationCoordinates = result.coordinates; search.destination = result.label; }).catch(() => {}));
  if (toGeocode.length) {
    setFeedStatus("Looking along that route…", true);
    await Promise.all(toGeocode);
  }
  state.search = search;
  applyFilters();
  document.querySelector("#journeys").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderMap() {
  if (!window.L) return;
  if (!state.map) {
    state.map = window.L.map(elements.map, { scrollWheelZoom: false }).setView([48, 10], 4);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(state.map);
    state.markers = window.L.layerGroup().addTo(state.map);
  }
  state.markers.clearLayers();
  const bounds = [];
  for (const ride of state.visibleRides) {
    let coordinates = ride.originCoordinates;
    if (coordinates?.legacyPrecise) coordinates = decodeGeohashCenter(encodeGeohash(coordinates.lat, coordinates.lon, 4));
    if (!coordinates) continue;
    const point = [coordinates.lat, coordinates.lon];
    bounds.push(point);
    const icon = window.L.divIcon({ className: `map-area-marker ${ride.type}`, html: "", iconSize: [28, 28], iconAnchor: [14, 14] });
    const marker = window.L.marker(point, { icon, title: `${ride.origin} to ${ride.destination}` }).addTo(state.markers);
    marker.bindPopup(`<strong>${escapeHtml(ride.origin)} → ${escapeHtml(ride.destination)}</strong><br>${escapeHtml(formatDateRange(ride.departureStart, ride.departureEnd))}<br><button class="map-popup-button" data-map-ride="${escapeHtml(ride.id)}">View journey</button>`);
  }
  if (bounds.length === 1) state.map.setView(bounds[0], 7);
  else if (bounds.length > 1) state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });
  setTimeout(() => state.map.invalidateSize(), 50);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("is-visible"), 3200);
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function setDefaultPostDates() {
  const start = elements.postForm.elements["departure-start"];
  const end = elements.postForm.elements["departure-end"];
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const localIso = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  start.min = localIso(today);
  end.min = localIso(today);
  if (!start.value) start.value = localIso(today);
  if (!end.value) end.value = localIso(tomorrow);
}

async function connectSigner() {
  if (!window.nostr || typeof window.nostr.getPublicKey !== "function" || typeof window.nostr.signEvent !== "function") {
    document.querySelector("#nostr-key-status")?.click();
    return false;
  }
  try {
    const pubkey = String(await window.nostr.getPublicKey()).toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(pubkey)) throw new Error("The signer returned an invalid public key.");
    state.userPubkey = pubkey;
    localStorage.setItem("rideshares:connected-pubkey", pubkey);
    await enrichProfiles([pubkey]);
    return true;
  } catch (error) {
    showToast(error?.message || "The signer did not connect.");
    return false;
  }
}

async function requireSigner() {
  return connectSigner();
}

function eventTemplateFromForm(form, origin, destination) {
  const type = form.elements["journey-type"].value;
  const startDate = form.elements["departure-start"].value;
  const endDate = form.elements["departure-end"].value || startDate;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  const now = Math.floor(Date.now() / 1000);
  const identifier = crypto.randomUUID();
  const originTags = geohashPrefixes(origin.geohash).map((value) => ["g", value]);
  const destinationTags = geohashPrefixes(destination.geohash).map((value) => ["dg", value]);
  const description = form.elements.description.value.trim();
  const via = form.elements.via.value.trim();
  const seekingDriver = type === "request" && form.elements["seeking-driver"].checked;
  const seekingCoHitchhiker = type === "request" && form.elements["seeking-cohitchhiker"].checked;
  const groupSize = String(Math.max(1, Number(form.elements["group-size"].value || 1)));
  const seats = String(Math.max(1, Number(form.elements.seats.value || 1)));
  const typeTopic = type === "offer" ? "ride-offer" : "hitchhike-request";
  const compatibilityTopic = type === "offer" ? "ride-offer" : "ride-request";
  const title = type === "offer" ? `Lift offered from ${origin.label} to ${destination.label}` : `Hitchhiking from ${origin.label} to ${destination.label}`;
  return {
    kind: 30402,
    created_at: now,
    content: description,
    tags: [
      ["d", identifier],
      ["title", title],
      ["summary", description.slice(0, 160)],
      ["published_at", String(now)],
      ["t", "rideshare"],
      ["t", typeTopic],
      ["t", compatibilityTopic],
      ...(seekingDriver ? [["t", "seeking-driver"], ["seeking", "driver"]] : []),
      ...(seekingCoHitchhiker ? [["t", "co-hitchhiker"], ["seeking", "co-hitchhiker"]] : []),
      ["t", "rideshares.org"],
      ...originTags,
      ...destinationTags,
      ["location", origin.label],
      ["location_dest", destination.label],
      ["departure_utc", String(Math.floor(start.getTime() / 1000))],
      ["departure_end_utc", String(Math.floor(end.getTime() / 1000))],
      ["expiration", String(Math.floor(end.getTime() / 1000) + 36 * 60 * 60)],
      ["status", "active"],
      ["price", "0", ""],
      ...(via ? [["via", via]] : []),
      ...(type === "offer" ? [["seats", seats]] : [["group_size", groupSize]]),
      ["client", "rideshares.org"],
      ["privacy", "area-only"],
    ],
  };
}

async function publishSignedEvent(event) {
  const publications = pool.publish(RELAYS, event);
  const promises = Array.isArray(publications) ? publications : [publications];
  const results = await Promise.allSettled(promises);
  const successes = results.filter((result) => result.status === "fulfilled");
  if (!successes.length) throw new Error("No relay accepted the journey. Please try again.");
  return successes.length;
}

async function submitJourney(event) {
  event.preventDefault();
  if (event.submitter?.value === "close") {
    elements.postDialog.close();
    return;
  }
  if (!(await requireSigner())) return;
  elements.postError.textContent = "";
  elements.publishButton.disabled = true;
  elements.publishButton.textContent = "Finding those areas…";
  try {
    const form = elements.postForm;
    const start = form.elements["departure-start"].value;
    const end = form.elements["departure-end"].value;
    if (end < start) throw new Error("The latest day must be on or after the earliest day.");
    if (form.elements["journey-type"].value === "request" && !form.elements["seeking-driver"].checked && !form.elements["seeking-cohitchhiker"].checked) {
      throw new Error("Choose whether you want to find a driver, a co-hitchhiker, or both.");
    }
    const [origin, destination] = await Promise.all([
      geocodePlace(form.elements.origin.value),
      geocodePlace(form.elements.destination.value),
    ]);
    elements.publishButton.textContent = "Waiting for your signer…";
    const template = eventTemplateFromForm(form, origin, destination);
    const signed = await window.nostr.signEvent(template);
    if (!verifyEvent(signed) || signed.pubkey !== state.userPubkey) throw new Error("Your signer returned an invalid journey.");
    elements.publishButton.textContent = "Publishing…";
    await publishSignedEvent(signed);
    state.rides = dedupeRideEvents([signed, ...state.rides]);
    state.search = {};
    state.showingMine = false;
    applyFilters();
    form.reset();
    setDefaultPostDates();
    elements.postDialog.close();
    showToast("Your journey is now on the road.");
    openRide(state.rides.find((ride) => ride.id === signed.id));
  } catch (error) {
    console.error(error);
    elements.postError.textContent = error?.message || "The journey could not be published.";
  } finally {
    elements.publishButton.disabled = false;
    elements.publishButton.textContent = "Publish journey";
  }
}

function detailMarkup(ride) {
  const profile = profileFor(ride.pubkey);
  const isMine = state.userPubkey && ride.pubkey === state.userPubkey;
  const npub = nip19.npubEncode(ride.pubkey);
  const messageUrl = `https://nos.trustroots.org/web/#${encodeURIComponent(npub)}`;
  const peopleText = ride.type === "offer" ? `${ride.seats || 1} seat${ride.seats === 1 ? "" : "s"} available` : `${ride.groupSize || 1} traveller${ride.groupSize === 1 ? "" : "s"}`;
  const seekingText = ride.seekingDriver && ride.seekingCoHitchhiker
    ? "A driver or co-hitchhiker"
    : ride.seekingCoHitchhiker
      ? "A co-hitchhiker"
      : "A driver";
  return `
    <button class="dialog-close" data-action="close-detail" aria-label="Close">×</button>
    <p class="eyebrow">${ride.type === "offer" ? "Lift offered" : "Hitchhiking journey"}</p>
    <h2>${escapeHtml(ride.origin)}<br />to ${escapeHtml(ride.destination)}</h2>
    <div class="detail-route journey-route">
      <div class="route-place">${escapeHtml(ride.origin)}</div>
      <div class="route-place">${escapeHtml(ride.destination)}</div>
    </div>
    <div class="detail-meta">
      <div><small>When</small><strong>${escapeHtml(formatDateRange(ride.departureStart, ride.departureEnd))}</strong></div>
      <div><small>${ride.type === "offer" ? "Space" : "Group"}</small><strong>${escapeHtml(peopleText)}</strong></div>
      ${ride.type === "request" ? `<div><small>Looking for</small><strong>${escapeHtml(seekingText)}</strong></div>` : ""}
      ${ride.via ? `<div><small>Going via</small><strong>${escapeHtml(ride.via)}</strong></div>` : ""}
      <div><small>Posted</small><strong>${escapeHtml(formatRelativeDate(ride.createdAt))}</strong></div>
    </div>
    <p class="detail-note">${escapeHtml(ride.description || "Open to figuring out the route together.")}</p>
    <div class="privacy-note"><span aria-hidden="true">◉</span><p>This post shows broad areas. Choose the exact meeting point together in a private message.</p></div>
    ${travellerMarkup(profile, ride.pubkey, true)}
    <div class="detail-actions">
      ${isMine ? `<button class="button danger-button" data-action="cancel-ride" data-ride-id="${escapeHtml(ride.id)}">Cancel journey</button>` : `<a class="button" href="${escapeHtml(messageUrl)}" target="_blank" rel="noreferrer">Message privately</a>`}
      <button class="button button-secondary" data-action="share-ride" data-ride-id="${escapeHtml(ride.id)}">Share</button>
    </div>`;
}

function openRide(ride) {
  if (!ride) return;
  elements.detailContent.innerHTML = detailMarkup(ride);
  elements.detailDialog.dataset.rideId = ride.id;
  openDialog(elements.detailDialog);
  const url = new URL(window.location.href);
  url.searchParams.set("journey", ride.id);
  history.replaceState(null, "", url);
  void enrichProfiles([ride.pubkey]).then(() => {
    if (elements.detailDialog.open && elements.detailDialog.dataset.rideId === ride.id) elements.detailContent.innerHTML = detailMarkup(ride);
  });
}

function closeDetail() {
  elements.detailDialog.close();
  const url = new URL(window.location.href);
  url.searchParams.delete("journey");
  history.replaceState(null, "", url);
}

function openJourneyFromUrl() {
  const id = new URL(window.location.href).searchParams.get("journey");
  if (id) openRide(state.rides.find((ride) => ride.id === id));
}

async function cancelRide(id) {
  const ride = state.rides.find((item) => item.id === id);
  if (!ride || ride.pubkey !== state.userPubkey || !(await requireSigner())) return;
  if (!window.confirm("Cancel this journey? It will disappear from active results.")) return;
  try {
    const tags = ride.event.tags.filter((tag) => !["status", "expiration"].includes(tag[0]));
    tags.push(["status", "cancelled"], ["expiration", String(Math.floor(Date.now() / 1000))]);
    const signed = await window.nostr.signEvent({ kind: 30402, created_at: Math.floor(Date.now() / 1000), content: ride.event.content, tags });
    if (!verifyEvent(signed) || signed.pubkey !== state.userPubkey) throw new Error("Your signer returned an invalid update.");
    await publishSignedEvent(signed);
    state.rides = dedupeRideEvents([signed, ...state.rides]);
    closeDetail();
    applyFilters();
    showToast("Journey cancelled.");
  } catch (error) {
    showToast(error?.message || "Could not cancel the journey.");
  }
}

async function shareRide(id) {
  const ride = state.rides.find((item) => item.id === id);
  if (!ride) return;
  const url = new URL(window.location.href);
  url.searchParams.set("journey", ride.id);
  const data = { title: `${ride.origin} to ${ride.destination} · Rideshares`, text: ride.description || "A journey on Rideshares", url: url.href };
  try {
    if (navigator.share) await navigator.share(data);
    else {
      await navigator.clipboard.writeText(url.href);
      showToast("Journey link copied.");
    }
  } catch (error) {
    if (error?.name !== "AbortError") showToast("Could not share this journey.");
  }
}

async function useMyArea() {
  if (!navigator.geolocation) return showToast("Location is not available in this browser.");
  const button = document.querySelector("#near-me-button");
  button.disabled = true;
  button.textContent = "Finding your area…";
  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const coordinates = { lat: position.coords.latitude, lon: position.coords.longitude };
      const label = await reverseGeocode(coordinates.lat, coordinates.lon);
      elements.searchOrigin.value = label;
      state.search.originCoordinates = coordinates;
      await runSearch();
    } catch {
      showToast("We could not name your area. You can type a nearby city instead.");
    } finally {
      button.disabled = false;
      button.innerHTML = '<span aria-hidden="true">◎</span> Use my area';
    }
  }, () => {
    button.disabled = false;
    button.innerHTML = '<span aria-hidden="true">◎</span> Use my area';
    showToast("Location was not shared. You can type a nearby city instead.");
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}

async function showMyJourneys() {
  if (!(await requireSigner())) return;
  state.showingMine = true;
  state.search = {};
  state.searchType = "all";
  document.querySelectorAll("[data-search-type]").forEach((button) => button.classList.toggle("is-active", button.dataset.searchType === "all"));
  applyFilters();
  document.querySelector("#journeys").scrollIntoView({ behavior: "smooth" });
}

function updatePostType() {
  const type = elements.postForm.elements["journey-type"].value;
  document.querySelectorAll(".choice-card").forEach((card) => card.classList.toggle("is-selected", card.querySelector("input").checked));
  document.querySelectorAll("[data-request-only]").forEach((element) => { element.hidden = type !== "request"; });
  document.querySelectorAll("[data-offer-only]").forEach((element) => { element.hidden = type !== "offer"; });
}

document.addEventListener("click", async (event) => {
  const actionElement = event.target.closest("[data-action]");
  if (actionElement) {
    const action = actionElement.dataset.action;
    if (action === "open-post") {
      if (!(await requireSigner())) return;
      setDefaultPostDates();
      openDialog(elements.postDialog);
    }
    if (action === "show-my-journeys") await showMyJourneys();
    if (action === "open-about") openDialog(elements.aboutDialog);
    if (action === "close-about") elements.aboutDialog.close();
    if (action === "close-detail") closeDetail();
    if (action === "cancel-ride") await cancelRide(actionElement.dataset.rideId);
    if (action === "share-ride") await shareRide(actionElement.dataset.rideId);
  }

  const card = event.target.closest("[data-ride-id]");
  if (card && !event.target.closest("button, a")) openRide(state.rides.find((ride) => ride.id === card.dataset.rideId));
  const mapButton = event.target.closest("[data-map-ride]");
  if (mapButton) openRide(state.rides.find((ride) => ride.id === mapButton.dataset.mapRide));
});

document.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".journey-card")) {
    event.preventDefault();
    openRide(state.rides.find((ride) => ride.id === event.target.dataset.rideId));
  }
});

elements.searchForm.addEventListener("submit", (event) => { event.preventDefault(); void runSearch(); });
document.querySelector("#near-me-button").addEventListener("click", useMyArea);
elements.postForm.addEventListener("submit", submitJourney);
elements.postForm.addEventListener("change", (event) => { if (event.target.name === "journey-type") updatePostType(); });
elements.postForm.elements.description.addEventListener("input", (event) => { document.querySelector("#description-count").textContent = String(event.target.value.length); });
elements.postForm.elements["departure-start"].addEventListener("change", (event) => {
  const end = elements.postForm.elements["departure-end"];
  end.min = event.target.value;
  if (end.value < event.target.value) end.value = event.target.value;
});

document.querySelectorAll("[data-search-type]").forEach((button) => button.addEventListener("click", () => {
  state.searchType = button.dataset.searchType;
  state.showingMine = false;
  document.querySelectorAll("[data-search-type]").forEach((item) => item.classList.toggle("is-active", item === button));
  applyFilters();
}));

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
  state.currentView = button.dataset.view;
  document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("is-active", item === button));
  renderJourneys();
}));

elements.detailDialog.addEventListener("close", () => {
  if (new URL(window.location.href).searchParams.has("journey")) {
    const url = new URL(window.location.href);
    url.searchParams.delete("journey");
    history.replaceState(null, "", url);
  }
});

window.addEventListener("beforeunload", () => pool.close(RELAYS));

setDefaultPostDates();
updatePostType();
const rememberedPubkey = localStorage.getItem("rideshares:connected-pubkey");
if (rememberedPubkey && /^[0-9a-f]{64}$/.test(rememberedPubkey) && window.nostr?.getPublicKey) {
  window.nostr.getPublicKey().then((pubkey) => {
    if (pubkey === rememberedPubkey) {
      state.userPubkey = pubkey;
    }
  }).catch(() => {});
}
void loadRides();
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
