import { LIVIANOS } from "./cleanListing.js";
import { attachPeerDeals, buildMarketIntel, pickBestDeal, pickWorstDeal } from "./intelligence.js";
import { buildVehicleCatalog } from "./catalog.js";

/** Resumen de mercado a partir de avisos ya saneados (snapshot estático). */

function pick(row) {
  if (!row) return null;
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
    image_url: row.image_url,
    delta_pct: row.delta_pct,
    deal: row.deal,
    peer_n: row.peer_n,
    reason: row.reason,
  };
}

function groupAvg(rows, keyFn, nameKey) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return [...map.entries()]
    .map(([name, items]) => {
      const prices = items.map((r) => r.price).sort((a, b) => a - b);
      const years = items.map((r) => r.year).filter(Boolean);
      const best = pickBestDeal(items);
      const worst = pickWorstDeal(items);
      return {
        [nameKey]: name,
        name,
        n: items.length,
        avg_price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        min_price: prices[0],
        median: prices[Math.floor(prices.length / 2)],
        max_price: prices[prices.length - 1],
        avg_year: years.length ? Math.round(years.reduce((a, b) => a + b, 0) / years.length) : null,
        cheapest: pick(best),
        expensive: pick(worst),
      };
    })
    .sort((a, b) => b.n - a.n);
}

export function overviewFromRows(rows, prev = {}) {
  const light = rows.filter((r) => LIVIANOS.has(r.category) || r.category === "comercial");
  const headline = light.length ? light : rows;
  const decorated = attachPeerDeals(headline);
  const intel = buildMarketIntel(headline);
  const prices = headline.map((r) => r.price).sort((a, b) => a - b);
  const yearHist = groupAvg(
    decorated.filter((r) => r.year >= 2005 && r.year <= 2027),
    (r) => r.year,
    "year"
  ).sort((a, b) => a.year - b.year);
  const byRegion = groupAvg(decorated, (r) => r.region || "Sin región", "region");
  const byCity = groupAvg(decorated.filter((r) => r.city), (r) => r.city, "city").slice(0, 24);

  return {
    totals: {
      listings: rows.length,
      livianos: light.length,
      brands: new Set(headline.map((r) => r.brand)).size,
      sources: new Set(rows.map((r) => r.source)).size,
      avg_price: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
      min_price: prices[0] || 0,
      max_price: prices[prices.length - 1] || 0,
    },
    bySource: groupAvg(rows, (r) => r.source, "source"),
    byCategory: groupAvg(rows, (r) => r.category, "category"),
    topBrands: groupAvg(headline, (r) => r.brand, "brand").slice(0, 12),
    byRegion: byRegion.slice(0, 16),
    yearHist,
    priceBuckets: groupAvg(
      headline.filter((r) => r.price >= 500_000 && r.price <= 80_000_000),
      (r) => Math.floor(r.price / 2_000_000) * 2_000_000,
      "bucket"
    ).sort((a, b) => a.bucket - b.bucket),
    opportunities: intel.opportunities,
    recentDrops: prev.recentDrops || [],
    geo: {
      cheapest: intel.opportunities,
      expensive: intel.overpriced,
      byRegion: byRegion.slice(0, 16),
      byCity,
    },
    series: {
      byYear: yearHist,
      daily: prev.series?.daily || [],
    },
    catalog: prev.catalog || [],
    vehicles: buildVehicleCatalog(headline),
  };
}
