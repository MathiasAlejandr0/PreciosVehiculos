import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLocation, MARKETPLACES } from "./lib/geo.js";
import { sanitizeListing, facetsFromRows } from "../shared/cleanListing.js";
import { overviewFromRows } from "../shared/overview.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "web", "public", "data");

const listingsPath = join(DATA, "listings.json");
const statsPath = join(DATA, "stats.json");
const raw = JSON.parse(readFileSync(listingsPath, "utf8"));
const before = (raw.rows || []).length;
const rows = (raw.rows || []).map((row) => sanitizeListing(row, parseLocation)).filter(Boolean);
const generatedAt = new Date().toISOString();
writeFileSync(listingsPath, JSON.stringify({ generatedAt, rows }));

let prev = {};
try {
  prev = JSON.parse(readFileSync(statsPath, "utf8"));
} catch {
  prev = {};
}
const stats = overviewFromRows(rows, {
  catalog: MARKETPLACES,
  series: prev.stats?.series,
  opportunities: prev.stats?.opportunities,
  recentDrops: prev.stats?.recentDrops,
});
writeFileSync(statsPath, JSON.stringify({ generatedAt, stats, facets: facetsFromRows(rows) }));
console.log(
  JSON.stringify({
    before,
    after: rows.length,
    dropped: before - rows.length,
    min: stats.totals.min_price,
    max: stats.totals.max_price,
    brands: stats.totals.brands,
  })
);
