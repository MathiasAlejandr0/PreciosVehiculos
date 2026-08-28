import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";
import { getOverview, getFacets, decorate } from "./analytics.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "web", "public", "data");

function compact(row) {
  const d = decorate(row);
  return {
    id: d.id,
    source: d.source,
    url: d.url,
    title: d.title,
    brand: d.brand,
    model: d.model,
    version: d.version,
    year: d.year,
    mileage: d.mileage,
    price: d.price,
    category: d.category,
    fuel: d.fuel,
    transmission: d.transmission,
    region: d.region,
    city: d.city,
    seller_type: d.seller_type,
    image_url: d.image_url,
    deal: d.deal,
    delta_pct: d.delta_pct,
  };
}

export function writeSnapshot() {
  if (!db) return null;
  mkdirSync(OUT_DIR, { recursive: true });
  const stats = getOverview();
  const facets = getFacets();
  const listings = db
    .prepare(
      `SELECT * FROM listings WHERE is_active = 1 AND price > 0 ORDER BY last_seen DESC LIMIT 8000`
    )
    .all()
    .map(compact);
  const payload = {
    generatedAt: new Date().toISOString(),
    stats,
    facets,
  };
  writeFileSync(join(OUT_DIR, "stats.json"), JSON.stringify(payload));
  writeFileSync(join(OUT_DIR, "listings.json"), JSON.stringify({ generatedAt: payload.generatedAt, rows: listings }));
  return { listings: listings.length, out: OUT_DIR };
}
