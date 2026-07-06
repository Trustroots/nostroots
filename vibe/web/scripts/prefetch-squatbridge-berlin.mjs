#!/usr/bin/env node
/**
 * Prefetch Berlin radar events for Squatbridge deploy-time static cache.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADAR_API = "https://radar.squat.net/api/1.2/search/events.json";
const FILTER_VALUE = "Berlin";
const OUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../examples/squatbridge-data/city/berlin.json"
);

const params = new URLSearchParams();
params.set("limit", "500");
params.set("fields", "title,url,date_time,offline,offline:map,offline:address,category,tag");
params.set("language", "en");
params.append("facets[city][]", FILTER_VALUE);

const url = RADAR_API + "?" + params.toString();

const res = await fetch(url);
if (!res.ok) {
  console.error("radar.squat.net HTTP", res.status, url);
  process.exit(1);
}

const data = await res.json();
if (!data || data.result === false) {
  console.error("radar.squat.net returned no events for Berlin");
  process.exit(1);
}

const payload = {
  fetchedAt: new Date().toISOString(),
  filterType: "city",
  filterValue: FILTER_VALUE,
  data,
};

await mkdir(dirname(OUT_PATH), { recursive: true });
await writeFile(OUT_PATH, JSON.stringify(payload));

const count = Number(data.count) || Object.keys(data.result || {}).length;
console.log("Wrote", OUT_PATH, "(" + count + " events)");
