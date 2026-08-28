import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(__dirname, "..", "data");
export const DB_PATH = join(DATA_DIR, "mercado.db");

export const IS_SERVERLESS = Boolean(process.env.VERCEL);

if (!IS_SERVERLESS) mkdirSync(DATA_DIR, { recursive: true });

export const db = IS_SERVERLESS ? null : new DatabaseSync(DB_PATH);
if (db) {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");
}

if (db) {
db.exec(`
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT,
  title TEXT,
  brand TEXT,
  model TEXT,
  version TEXT,
  year INTEGER,
  mileage INTEGER,
  price INTEGER,
  currency TEXT DEFAULT 'CLP',
  category TEXT,
  body_type TEXT,
  fuel TEXT,
  transmission TEXT,
  drivetrain TEXT,
  region TEXT,
  city TEXT,
  seller_type TEXT,
  seller_name TEXT,
  image_url TEXT,
  condition TEXT,
  fingerprint TEXT,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  seen_at TEXT NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES listings(id)
);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  stats_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_listings_brand_model ON listings(brand, model);
CREATE INDEX IF NOT EXISTS idx_listings_year ON listings(year);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region);
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(is_active);
CREATE INDEX IF NOT EXISTS idx_listings_fp ON listings(fingerprint);
CREATE INDEX IF NOT EXISTS idx_history_listing ON price_history(listing_id, seen_at);
`);
}

const upsertStmt = db?.prepare(`
INSERT INTO listings (
  id, source, external_id, url, title, brand, model, version, year, mileage, price,
  currency, category, body_type, fuel, transmission, drivetrain, region, city,
  seller_type, seller_name, image_url, condition, fingerprint, first_seen, last_seen, is_active
) VALUES (
  @id, @source, @external_id, @url, @title, @brand, @model, @version, @year, @mileage, @price,
  @currency, @category, @body_type, @fuel, @transmission, @drivetrain, @region, @city,
  @seller_type, @seller_name, @image_url, @condition, @fingerprint, @now, @now, 1
)
ON CONFLICT(id) DO UPDATE SET
  url=excluded.url,
  title=excluded.title,
  brand=COALESCE(excluded.brand, listings.brand),
  model=COALESCE(excluded.model, listings.model),
  version=COALESCE(excluded.version, listings.version),
  year=COALESCE(excluded.year, listings.year),
  mileage=COALESCE(excluded.mileage, listings.mileage),
  price=COALESCE(excluded.price, listings.price),
  category=COALESCE(excluded.category, listings.category),
  body_type=COALESCE(excluded.body_type, listings.body_type),
  fuel=COALESCE(excluded.fuel, listings.fuel),
  transmission=COALESCE(excluded.transmission, listings.transmission),
  drivetrain=COALESCE(excluded.drivetrain, listings.drivetrain),
  region=COALESCE(excluded.region, listings.region),
  city=COALESCE(excluded.city, listings.city),
  seller_type=COALESCE(excluded.seller_type, listings.seller_type),
  seller_name=COALESCE(excluded.seller_name, listings.seller_name),
  image_url=COALESCE(excluded.image_url, listings.image_url),
  fingerprint=excluded.fingerprint,
  last_seen=excluded.last_seen,
  is_active=1
`);

const selectPrice = db?.prepare("SELECT price FROM listings WHERE id = ?");
const insertHistory = db?.prepare(
  "INSERT INTO price_history (listing_id, price, seen_at) VALUES (?, ?, ?)"
);

export function listingId(source, externalId) {
  return `${source}:${externalId}`;
}

function nil(value) {
  return value === undefined ? null : value;
}

export function upsertListings(rows) {
  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  let priceChanges = 0;
  db.exec("BEGIN");
  try {
    for (const row of rows) {
      if (!row?.external_id || !row.source) continue;
      if (!row.price || row.price < 200000 || row.price > 400000000) continue;
      const id = listingId(row.source, row.external_id);
      const prev = selectPrice.get(id);
      upsertStmt.run({
        id,
        source: row.source,
        external_id: String(row.external_id),
        url: nil(row.url),
        title: nil(row.title),
        brand: nil(row.brand),
        model: nil(row.model),
        version: nil(row.version),
        year: nil(row.year),
        mileage: nil(row.mileage),
        price: row.price,
        currency: row.currency || "CLP",
        category: nil(row.category),
        body_type: nil(row.body_type),
        fuel: nil(row.fuel),
        transmission: nil(row.transmission),
        drivetrain: nil(row.drivetrain),
        region: nil(row.region),
        city: nil(row.city),
        seller_type: nil(row.seller_type),
        seller_name: nil(row.seller_name),
        image_url: nil(row.image_url),
        condition: row.condition || "usado",
        fingerprint: nil(row.fingerprint),
        now,
      });
      if (!prev) {
        inserted += 1;
        insertHistory.run(id, row.price, now);
      } else {
        updated += 1;
        if (prev.price && row.price && prev.price !== row.price) {
          priceChanges += 1;
          insertHistory.run(id, row.price, now);
        }
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return { inserted, updated, priceChanges, total: rows.length };
}

export function countListings() {
  if (!db) return 0;
  return db.prepare("SELECT COUNT(*) AS n FROM listings WHERE is_active = 1").get().n;
}
