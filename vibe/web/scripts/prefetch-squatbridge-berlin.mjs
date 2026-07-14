#!/usr/bin/env node
/**
 * Prefetch Berlin radar events for Squatbridge deploy-time static cache.
 * Falls back to the committed seed file when radar.squat.net blocks CI runners.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADAR_API = "https://radar.squat.net/api/1.2/search/events.json";
const FILTER_VALUE = "Berlin";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(SCRIPT_DIR, "../examples/squatbridge/squatbridge-data/city");
const OUT_PATH = join(OUT_DIR, "berlin.json");
const SEED_PATH = join(OUT_DIR, "berlin.seed.json");
const USER_AGENT = "Nostroots/1.0 (+https://nos.trustroots.org; squatbridge prefetch)";

const params = new URLSearchParams();
params.set("limit", "500");
params.set("fields", "title,url,date_time,offline,offline:map,offline:address,category,tag");
params.set("language", "en");
params.append("facets[city][]", FILTER_VALUE);

const url = RADAR_API + "?" + params.toString();

async function writePayload(data, source) {
  const payload = {
    fetchedAt: new Date().toISOString(),
    filterType: "city",
    filterValue: FILTER_VALUE,
    data,
    prefetchSource: source,
  };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload));
  const count = Number(data.count) || Object.keys(data.result || {}).length;
  console.log("Wrote", OUT_PATH, "(" + count + " events,", source + ")");
}

async function useSeedFallback(reason) {
  let raw;
  try {
    raw = await readFile(SEED_PATH, "utf8");
  } catch (err) {
    console.error("radar.squat.net prefetch failed:", reason);
    console.error("No seed cache at", SEED_PATH, "—", err.message || err);
    process.exit(1);
  }

  let seed;
  try {
    seed = JSON.parse(raw);
  } catch (err) {
    console.error("Invalid seed cache at", SEED_PATH, "—", err.message || err);
    process.exit(1);
  }

  const data = seed.data || seed;
  if (!data || data.result === false) {
    console.error("Seed cache at", SEED_PATH, "contains no Berlin events");
    process.exit(1);
  }

  console.warn("radar.squat.net prefetch failed:", reason);
  console.warn("Using committed seed cache from", SEED_PATH);
  await writePayload(data, "seed");
}

let res;
try {
  res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
} catch (err) {
  await useSeedFallback(err.message || String(err));
  process.exit(0);
}

if (!res.ok) {
  await useSeedFallback("HTTP " + res.status);
  process.exit(0);
}

const data = await res.json();
if (!data || data.result === false) {
  await useSeedFallback("empty Berlin result");
  process.exit(0);
}

await writePayload(data, "live");
