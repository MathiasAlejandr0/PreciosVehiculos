import { db } from "./db.js";
import { dealLabel } from "./lib/normalize.js";
import { MARKETPLACES } from "./lib/geo.js";

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

function summarize(prices) {
  let sorted = prices.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  if (sorted.length >= 8) {
    const q1 = percentile(sorted, 0.25);
    const q3 = percentile(sorted, 0.75);
    const fence = (q3 - q1) * 3;
    const clipped = sorted.filter((n) => n >= q1 - fence && n <= q3 + fence);
    if (clipped.length >= 5) sorted = clipped;
  }
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = Math.round(sum / sorted.length);
  const p25 = percentile(sorted, 0.25);
  const p50 = percentile(sorted, 0.5);
  const p75 = percentile(sorted, 0.75);
  return {
    n: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    p25,
    p50,
    p75,
    iqr: p75 - p25,
  };
}

function whereFrom(filters = {}, alias = "") {
  const p = alias ? `${alias}.` : "";
  const clauses = [`${p}is_active = 1`, `${p}price > 0`];
  const params = {};
  if (filters.q) {
    clauses.push(`(${p}title LIKE @q OR ${p}brand LIKE @q OR ${p}model LIKE @q)`);
    params.q = `%${filters.q}%`;
  }
  if (filters.brand) {
    clauses.push(`${p}brand = @brand`);
    params.brand = filters.brand;
  }
  if (filters.model) {
    clauses.push(`${p}model = @model`);
    params.model = filters.model;
  }
  if (filters.category) {
    clauses.push(`${p}category = @category`);
    params.category = filters.category;
  }
  if (filters.source) {
    clauses.push(`${p}source = @source`);
    params.source = filters.source;
  }
  if (filters.region) {
    clauses.push(`${p}region = @region`);
    params.region = filters.region;
  }
  if (filters.city) {
    clauses.push(`${p}city = @city`);
    params.city = filters.city;
  }
  if (filters.seller_type) {
    clauses.push(`${p}seller_type = @seller_type`);
    params.seller_type = filters.seller_type;
  }
  if (filters.fuel) {
    clauses.push(`${p}fuel LIKE @fuel`);
    params.fuel = `%${filters.fuel}%`;
  }
  if (filters.transmission) {
    clauses.push(`${p}transmission LIKE @transmission`);
    params.transmission = `%${filters.transmission}%`;
  }
  if (filters.year_min) {
    clauses.push(`${p}year >= @year_min`);
    params.year_min = Number(filters.year_min);
  }
  if (filters.year_max) {
    clauses.push(`${p}year <= @year_max`);
    params.year_max = Number(filters.year_max);
  }
  if (filters.price_min) {
    clauses.push(`${p}price >= @price_min`);
    params.price_min = Number(filters.price_min);
  }
  if (filters.price_max) {
    clauses.push(`${p}price <= @price_max`);
    params.price_max = Number(filters.price_max);
  }
  if (filters.km_min) {
    clauses.push(`${p}mileage >= @km_min`);
    params.km_min = Number(filters.km_min);
  }
  if (filters.km_max) {
    clauses.push(`${p}mileage <= @km_max`);
    params.km_max = Number(filters.km_max);
  }
  return { sql: clauses.join(" AND "), params };
}

const compsCache = new Map();

export function comparableStats(row) {
  if (!row?.brand || !row.year) return null;
  const key = `${row.brand}|${row.model || ""}|${row.year}`;
  if (compsCache.has(key)) return compsCache.get(key);
  let rows = db
    .prepare(
      `SELECT price FROM listings
       WHERE is_active = 1 AND brand = ? AND IFNULL(model,'') = IFNULL(?, '') AND year = ? AND price > 0`
    )
    .all(row.brand, row.model || null, row.year);
  if (rows.length < 6 && row.brand) {
    rows = db
      .prepare(
        `SELECT price FROM listings
         WHERE is_active = 1 AND brand = ? AND year BETWEEN ? AND ? AND price > 0`
      )
      .all(row.brand, row.year - 1, row.year + 1);
  }
  const stats = summarize(rows.map((r) => r.price));
  compsCache.set(key, stats);
  return stats;
}

export function decorate(row) {
  const stats = comparableStats(row);
  const deltaPct = stats?.p50 && row.price ? Math.round(((row.price - stats.p50) / stats.p50) * 1000) / 10 : null;
  const deal = dealLabel(deltaPct);
  const days =
    row.first_seen && row.last_seen
      ? Math.max(0, Math.round((Date.now() - new Date(row.first_seen).getTime()) / 86400000))
      : null;
  return { ...row, market: stats, delta_pct: deltaPct, deal, days_listed: days };
}

export function getEvolution() {
  if (!db) return { daily: [], byYear: [] };
  const daily = db.prepare(`
    SELECT substr(seen_at, 1, 10) AS day,
           COUNT(*) AS n,
           ROUND(AVG(price)) AS avg_price,
           MIN(price) AS min_price,
           MAX(price) AS max_price
    FROM price_history
    GROUP BY day
    ORDER BY day
  `).all();
  const byYear = db.prepare(`
    SELECT year,
           COUNT(*) AS n,
           ROUND(AVG(price)) AS avg_price,
           MIN(price) AS min_price,
           MAX(price) AS max_price
    FROM listings
    WHERE is_active = 1 AND year BETWEEN 2008 AND 2027 AND price > 0
    GROUP BY year
    ORDER BY year
  `).all();
  return { daily, byYear };
}

function pickListing(row) {
  return {
    id: row.id,
    source: row.source,
    url: row.url,
    title: row.title,
    brand: row.brand,
    model: row.model,
    year: row.year,
    mileage: row.mileage,
    price: row.price,
    city: row.city,
    region: row.region,
  };
}

export function getGeoReport() {
  if (!db) return { cheapest: [], expensive: [], byRegion: [], byCity: [] };
  const rows = db.prepare(`
    SELECT id, source, url, title, brand, model, year, mileage, price, city, region
    FROM listings WHERE is_active = 1 AND price > 0
  `).all();

  const cheapest = [...rows].sort((a, b) => a.price - b.price).slice(0, 12).map(pickListing);
  const expensive = [...rows].sort((a, b) => b.price - a.price).slice(0, 12).map(pickListing);

  function group(keyFn) {
    const map = new Map();
    for (const row of rows) {
      const key = keyFn(row) || "Sin dato";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return [...map.entries()]
      .map(([name, list]) => {
        const prices = list.map((r) => r.price).sort((a, b) => a - b);
        const min = list.reduce((a, b) => (a.price < b.price ? a : b));
        const max = list.reduce((a, b) => (a.price > b.price ? a : b));
        const mid = prices[Math.floor(prices.length / 2)];
        return {
          name,
          n: list.length,
          min_price: prices[0],
          max_price: prices[prices.length - 1],
          median: mid,
          cheapest: pickListing(min),
          expensive: pickListing(max),
        };
      })
      .sort((a, b) => b.n - a.n);
  }

  return {
    cheapest,
    expensive,
    byRegion: group((r) => r.region).slice(0, 16),
    byCity: group((r) => r.city).slice(0, 24),
  };
}

export function getOverview() {
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS listings,
      COUNT(DISTINCT brand) AS brands,
      COUNT(DISTINCT source) AS sources,
      ROUND(AVG(price)) AS avg_price,
      MIN(price) AS min_price,
      MAX(price) AS max_price
    FROM listings WHERE is_active = 1 AND price > 0
  `).get();

  const bySource = db.prepare(`
    SELECT source, COUNT(*) AS n, ROUND(AVG(price)) AS avg_price
    FROM listings WHERE is_active = 1 AND price > 0
    GROUP BY source ORDER BY n DESC
  `).all();

  const byCategory = db.prepare(`
    SELECT category, COUNT(*) AS n, ROUND(AVG(price)) AS avg_price
    FROM listings WHERE is_active = 1 AND price > 0
    GROUP BY category ORDER BY n DESC
  `).all();

  const topBrands = db.prepare(`
    SELECT brand, COUNT(*) AS n, ROUND(AVG(price)) AS avg_price, ROUND(AVG(year)) AS avg_year
    FROM listings WHERE is_active = 1 AND price > 0 AND brand IS NOT NULL
    GROUP BY brand ORDER BY n DESC LIMIT 12
  `).all();

  const byRegion = db.prepare(`
    SELECT IFNULL(region, 'Sin región') AS region, COUNT(*) AS n, ROUND(AVG(price)) AS avg_price
    FROM listings WHERE is_active = 1 AND price > 0
    GROUP BY region ORDER BY n DESC LIMIT 16
  `).all();

  const yearHist = db.prepare(`
    SELECT year, COUNT(*) AS n, ROUND(AVG(price)) AS avg_price
    FROM listings WHERE is_active = 1 AND year BETWEEN 2005 AND 2027 AND price > 0
    GROUP BY year ORDER BY year
  `).all();

  const priceBuckets = db.prepare(`
    SELECT CAST(price / 2000000 AS INTEGER) * 2000000 AS bucket, COUNT(*) AS n
    FROM listings WHERE is_active = 1 AND price BETWEEN 500000 AND 80000000
    GROUP BY bucket ORDER BY bucket
  `).all();

  const opportunities = db.prepare(`
    SELECT * FROM listings
    WHERE is_active = 1 AND price > 0 AND brand IS NOT NULL AND year IS NOT NULL
    ORDER BY last_seen DESC LIMIT 400
  `).all()
    .map(decorate)
    .filter((r) => r.deal.key === "oportunidad" && r.market?.n >= 5)
    .sort((a, b) => (a.delta_pct ?? 0) - (b.delta_pct ?? 0))
    .slice(0, 12);

  const recentDrops = db.prepare(`
    SELECT l.*, h.price AS old_price, h.seen_at AS dropped_at
    FROM listings l
    JOIN price_history h ON h.listing_id = l.id
    WHERE l.is_active = 1 AND h.price > l.price
    ORDER BY h.seen_at DESC LIMIT 8
  `).all();

  return {
    totals,
    bySource,
    byCategory,
    topBrands,
    byRegion,
    yearHist,
    priceBuckets,
    opportunities,
    recentDrops,
    geo: getGeoReport(),
    series: getEvolution(),
    catalog: MARKETPLACES,
  };
}

export function getFacets() {
  const brands = db.prepare(`
    SELECT brand AS value, COUNT(*) AS n FROM listings
    WHERE is_active = 1 AND brand IS NOT NULL GROUP BY brand ORDER BY n DESC LIMIT 80
  `).all();
  const models = db.prepare(`
    SELECT brand, model AS value, COUNT(*) AS n FROM listings
    WHERE is_active = 1 AND model IS NOT NULL GROUP BY brand, model ORDER BY n DESC LIMIT 400
  `).all();
  const regions = db.prepare(`
    SELECT region AS value, COUNT(*) AS n FROM listings
    WHERE is_active = 1 AND region IS NOT NULL GROUP BY region ORDER BY n DESC
  `).all();
  const sources = db.prepare(`
    SELECT source AS value, COUNT(*) AS n FROM listings
    WHERE is_active = 1 GROUP BY source ORDER BY n DESC
  `).all();
  const categories = db.prepare(`
    SELECT category AS value, COUNT(*) AS n FROM listings
    WHERE is_active = 1 AND category IS NOT NULL GROUP BY category ORDER BY n DESC
  `).all();
  const cities = db.prepare(`
    SELECT city AS value, COUNT(*) AS n FROM listings
    WHERE is_active = 1 AND city IS NOT NULL AND city != '' GROUP BY city ORDER BY n DESC LIMIT 80
  `).all();
  return { brands, models, regions, cities, sources, categories };
}

export function searchListings(filters = {}) {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(60, Math.max(10, Number(filters.limit) || 24));
  const offset = (page - 1) * limit;
  const { sql, params } = whereFrom(filters);
  const sortMap = {
    price_asc: "price ASC",
    price_desc: "price DESC",
    year_desc: "year DESC",
    km_asc: "mileage ASC",
    recent: "last_seen DESC",
  };
  const order = sortMap[filters.sort] || "last_seen DESC";
  const total = db.prepare(`SELECT COUNT(*) AS n FROM listings WHERE ${sql}`).get(params).n;
  const rows = db
    .prepare(`SELECT * FROM listings WHERE ${sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`)
    .all(params)
    .map(decorate);
  return { total, page, limit, rows };
}

export function getListing(id) {
  const row = db.prepare("SELECT * FROM listings WHERE id = ?").get(id);
  if (!row) return null;
  const history = db
    .prepare("SELECT price, seen_at FROM price_history WHERE listing_id = ? ORDER BY seen_at")
    .all(id);
  const comps = db
    .prepare(
      `SELECT * FROM listings
       WHERE is_active = 1 AND id != ? AND brand = ? AND IFNULL(model,'') = IFNULL(?, '')
       AND year BETWEEN ? AND ? AND price > 0
       ORDER BY ABS(price - ?) LIMIT 8`
    )
    .all(id, row.brand, row.model, (row.year || 2015) - 1, (row.year || 2015) + 1, row.price || 0)
    .map(decorate);
  const twins = row.fingerprint
    ? db
        .prepare("SELECT * FROM listings WHERE is_active = 1 AND fingerprint = ? AND id != ? LIMIT 6")
        .all(row.fingerprint, id)
    : [];
  return { ...decorate(row), history, comps, twins };
}

export function tasar({ brand, model, year, mileage, category }) {
  const clauses = ["is_active = 1", "price > 0", "brand = @brand"];
  const params = { brand };
  if (category) {
    clauses.push("category = @category");
    params.category = category;
  }
  let rows = [];
  if (model && year) {
    rows = db
      .prepare(
        `SELECT price, mileage, year FROM listings
         WHERE ${clauses.join(" AND ")} AND model = @model AND year BETWEEN @ymin AND @ymax`
      )
      .all({ ...params, model, ymin: Number(year) - 1, ymax: Number(year) + 1 });
  }
  if (rows.length < 5 && model) {
    rows = db
      .prepare(`SELECT price, mileage, year FROM listings WHERE ${clauses.join(" AND ")} AND model = @model`)
      .all({ ...params, model });
  }
  if (rows.length < 5 && year) {
    rows = db
      .prepare(
        `SELECT price, mileage, year FROM listings
         WHERE ${clauses.join(" AND ")} AND year BETWEEN @ymin AND @ymax`
      )
      .all({ ...params, ymin: Number(year) - 2, ymax: Number(year) + 2 });
  }
  if (rows.length < 5) {
    rows = db.prepare(`SELECT price, mileage, year FROM listings WHERE ${clauses.join(" AND ")}`).all(params);
  }
  let sample = rows;
  if (mileage && rows.length >= 8) {
    const km = Number(mileage);
    const close = rows.filter((r) => r.mileage && Math.abs(r.mileage - km) <= Math.max(25000, km * 0.35));
    if (close.length >= 5) sample = close;
  }
  const stats = summarize(sample.map((r) => r.price));
  if (!stats) return { sample: 0 };
  const buy = Math.round(stats.p25 * 0.98);
  const sell = Math.round(stats.p50 * 1.03);
  return {
    sample: stats.n,
    stats,
    suggested_buy: buy,
    suggested_list: sell,
    band: { low: stats.p25, mid: stats.p50, high: stats.p75 },
  };
}

export function clearCompsCache() {
  compsCache.clear();
}
