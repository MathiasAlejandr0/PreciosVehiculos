import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";
import { parseLocation, MARKETPLACES } from "./lib/geo.js";
import { sanitizeListing, facetsFromRows } from "../shared/cleanListing.js";
import { overviewFromRows } from "../shared/overview.js";
import { attachPeerDeals } from "../shared/intelligence.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "web", "public", "data");

function compact(row) {
  return {
    id: row.id,
    source: row.source,
    url: row.url,
    title: row.title,
    brand: row.brand,
    model: row.model,
    version: row.version,
    year: row.year,
    mileage: row.mileage,
    price: row.price,
    category: row.category,
    fuel: row.fuel,
    transmission: row.transmission,
    region: row.region,
    city: row.city,
    seller_type: row.seller_type,
    drivetrain: row.drivetrain,
    image_url: row.image_url,
    first_seen: row.first_seen,
    last_seen: row.last_seen,
  };
}

export function writeSnapshot() {
  if (!db) return null;
  mkdirSync(OUT_DIR, { recursive: true });
  const listings = db
    .prepare(
      `SELECT * FROM listings WHERE is_active = 1 AND price > 0 ORDER BY last_seen DESC LIMIT 8000`
    )
    .all()
    .map(compact)
    .map((row) => sanitizeListing(row, parseLocation))
    .filter(Boolean);
  const withDeals = attachPeerDeals(listings);
  const facets = facetsFromRows(withDeals);
  const stats = overviewFromRows(withDeals, { catalog: MARKETPLACES });
  const payload = {
    generatedAt: new Date().toISOString(),
    stats,
    facets,
  };
  writeFileSync(join(OUT_DIR, "stats.json"), JSON.stringify(payload));
  writeFileSync(join(OUT_DIR, "listings.json"), JSON.stringify({ generatedAt: payload.generatedAt, rows: withDeals }));
  return { listings: listings.length, out: OUT_DIR };
}
