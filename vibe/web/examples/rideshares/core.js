const EARTH_RADIUS_KM = 6371;

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tagValues(tags, name) {
  return (Array.isArray(tags) ? tags : [])
    .filter((tag) => Array.isArray(tag) && tag[0] === name && tag.length > 1)
    .map((tag) => String(tag[1]));
}

export function tagValue(tags, name, fallback = "") {
  return tagValues(tags, name)[0] || fallback;
}

export function trustrootsProfileUrl(nip05, verified = false) {
  if (!verified) return "";
  const match = String(nip05 || "").trim().match(/^([a-z0-9_.-]+)@trustroots\.org$/i);
  return match ? `https://www.trustroots.org/profile/${encodeURIComponent(match[1].toLowerCase())}` : "";
}

function unixDate(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : null;
}

function numberTag(tags, name, fallback = null) {
  const value = Number(tagValue(tags, name));
  return Number.isFinite(value) ? value : fallback;
}

export function parseRideEvent(event) {
  if (!event || Number(event.kind) !== 30402 || !Array.isArray(event.tags)) return null;

  const topics = new Set(tagValues(event.tags, "t"));
  if (!topics.has("rideshare") && !topics.has("travel-partner")) return null;

  let type = "request";
  if (topics.has("ride-offer")) type = "offer";
  if (topics.has("ride-request") || topics.has("hitchhike-request") || topics.has("travel-partner")) type = "request";
  const seekingValues = new Set(tagValues(event.tags, "seeking"));
  const hasExplicitSeeking = seekingValues.size > 0 || topics.has("seeking-driver") || topics.has("co-hitchhiker");
  const seekingDriver = type === "request" && (
    seekingValues.has("driver") || topics.has("seeking-driver") || (!hasExplicitSeeking && !topics.has("travel-partner"))
  );
  const seekingCoHitchhiker = type === "request" && (
    seekingValues.has("co-hitchhiker") || topics.has("co-hitchhiker") || topics.has("travel-partner")
  );

  const departureStart = unixDate(tagValue(event.tags, "departure_utc"));
  const departureEnd = unixDate(tagValue(event.tags, "departure_end_utc")) || departureStart;
  const publishedAt = unixDate(tagValue(event.tags, "published_at")) || unixDate(event.created_at);
  const status = tagValue(event.tags, "status", "active").toLowerCase();
  const identifier = tagValue(event.tags, "d", event.id || "");
  const geohashes = tagValues(event.tags, "g");
  const destinationGeohashes = tagValues(event.tags, "dg");
  const originGeohash = geohashes.sort((a, b) => b.length - a.length)[0] || "";
  const destinationGeohash = destinationGeohashes.sort((a, b) => b.length - a.length)[0] || "";

  const originLat = numberTag(event.tags, "origin_lat");
  const originLon = numberTag(event.tags, "origin_lon");
  const destinationLat = numberTag(event.tags, "dest_lat");
  const destinationLon = numberTag(event.tags, "dest_lon");

  return {
    id: String(event.id || ""),
    identifier,
    pubkey: String(event.pubkey || ""),
    createdAt: unixDate(event.created_at) || new Date(0),
    publishedAt,
    type,
    seekingDriver,
    seekingCoHitchhiker,
    status,
    title: tagValue(event.tags, "title"),
    summary: tagValue(event.tags, "summary"),
    description: String(event.content || "").trim(),
    origin: tagValue(event.tags, "location", "Somewhere"),
    destination: tagValue(event.tags, "location_dest", "Going my way"),
    via: tagValue(event.tags, "via"),
    departureStart,
    departureEnd,
    expiresAt: unixDate(tagValue(event.tags, "expiration")),
    groupSize: Math.max(1, numberTag(event.tags, "group_size", 1)),
    seats: Math.max(0, numberTag(event.tags, "seats", 0)),
    originGeohash,
    destinationGeohash,
    originCoordinates: validCoordinates(originLat, originLon)
      ? { lat: originLat, lon: originLon, legacyPrecise: true }
      : decodeGeohashCenter(originGeohash),
    destinationCoordinates: validCoordinates(destinationLat, destinationLon)
      ? { lat: destinationLat, lon: destinationLon, legacyPrecise: true }
      : decodeGeohashCenter(destinationGeohash),
    event,
  };
}

function validCoordinates(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
}

export function dedupeRideEvents(events) {
  const latest = new Map();
  for (const event of events || []) {
    const ride = parseRideEvent(event);
    if (!ride || !ride.identifier || !ride.pubkey) continue;
    const key = `${ride.pubkey}:${ride.identifier}`;
    const current = latest.get(key);
    if (!current || ride.createdAt > current.createdAt) latest.set(key, ride);
  }
  return [...latest.values()];
}

export function isRideVisible(ride, now = new Date()) {
  if (!ride || ride.status !== "active") return false;
  const expiry = ride.expiresAt || (ride.departureEnd ? new Date(ride.departureEnd.getTime() + 36 * 60 * 60 * 1000) : null);
  if (expiry && expiry < now) return false;
  if (!ride.departureStart && ride.createdAt < new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)) return false;
  return true;
}

function containsPlace(haystack, needle) {
  const a = normalizeText(haystack);
  const b = normalizeText(needle);
  if (!b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const tokens = b.split(" ").filter((token) => token.length > 2);
  return tokens.length > 0 && tokens.every((token) => a.includes(token));
}

export function haversineKm(a, b) {
  if (!a || !b) return Infinity;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLon = ((b.lon - a.lon) * Math.PI) / 180;
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function overlapsDay(ride, dateValue) {
  if (!dateValue) return true;
  const dayStart = new Date(`${dateValue}T00:00:00`);
  const dayEnd = new Date(`${dateValue}T23:59:59`);
  const start = ride.departureStart || ride.createdAt;
  const end = ride.departureEnd || start;
  return start <= dayEnd && end >= dayStart;
}

export function matchRides(rides, query = {}) {
  const originRadiusKm = Number(query.originRadiusKm || 80);
  const destinationRadiusKm = Number(query.destinationRadiusKm || 120);

  return (rides || [])
    .filter((ride) => isRideVisible(ride, query.now || new Date()))
    .filter((ride) => {
      if (!query.type || query.type === "all") return true;
      if (query.type === "cohitchhiker") return ride.seekingCoHitchhiker;
      if (query.type === "driver") return ride.type === "offer" || ride.seekingDriver;
      return ride.type === query.type;
    })
    .filter((ride) => overlapsDay(ride, query.date))
    .map((ride) => {
      const originDistance = query.originCoordinates && ride.originCoordinates
        ? haversineKm(query.originCoordinates, ride.originCoordinates)
        : Infinity;
      const destinationDistance = query.destinationCoordinates && ride.destinationCoordinates
        ? haversineKm(query.destinationCoordinates, ride.destinationCoordinates)
        : Infinity;
      const originMatches = !query.origin || containsPlace(ride.origin, query.origin) || originDistance <= originRadiusKm;
      const destinationHaystack = `${ride.destination} ${ride.via}`;
      const destinationMatches = !query.destination || containsPlace(destinationHaystack, query.destination) || destinationDistance <= destinationRadiusKm;
      if (!originMatches || !destinationMatches) return null;

      let score = 0;
      if (query.origin && containsPlace(ride.origin, query.origin)) score += 60;
      if (query.destination && containsPlace(destinationHaystack, query.destination)) score += 60;
      if (Number.isFinite(originDistance)) score += Math.max(0, 40 - originDistance / 2);
      if (Number.isFinite(destinationDistance)) score += Math.max(0, 40 - destinationDistance / 3);
      if (query.date && overlapsDay(ride, query.date)) score += 35;
      if (ride.type === "offer") score += 4;
      return { ...ride, matchScore: score };
    })
    .filter(Boolean)
    .sort((a, b) => b.matchScore - a.matchScore || (a.departureStart || a.createdAt) - (b.departureStart || b.createdAt));
}

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function encodeGeohash(latitude, longitude, precision = 4) {
  let lat = [-90, 90];
  let lon = [-180, 180];
  let even = true;
  let bit = 0;
  let value = 0;
  let output = "";
  while (output.length < precision) {
    const range = even ? lon : lat;
    const coordinate = even ? longitude : latitude;
    const midpoint = (range[0] + range[1]) / 2;
    if (coordinate >= midpoint) {
      value = (value << 1) | 1;
      range[0] = midpoint;
    } else {
      value <<= 1;
      range[1] = midpoint;
    }
    even = !even;
    bit += 1;
    if (bit === 5) {
      output += BASE32[value];
      bit = 0;
      value = 0;
    }
  }
  return output;
}

export function geohashPrefixes(hash, minimumLength = 2) {
  const value = String(hash || "");
  const result = [];
  for (let length = minimumLength; length <= value.length; length += 1) result.push(value.slice(0, length));
  return result;
}

export function decodeGeohashCenter(hash) {
  if (!hash) return null;
  let lat = [-90, 90];
  let lon = [-180, 180];
  let even = true;
  for (const character of String(hash).toLowerCase()) {
    const value = BASE32.indexOf(character);
    if (value < 0) return null;
    for (let mask = 16; mask > 0; mask >>= 1) {
      const range = even ? lon : lat;
      const midpoint = (range[0] + range[1]) / 2;
      if (value & mask) range[0] = midpoint;
      else range[1] = midpoint;
      even = !even;
    }
  }
  return { lat: (lat[0] + lat[1]) / 2, lon: (lon[0] + lon[1]) / 2, approximate: true };
}
