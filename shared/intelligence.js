import { LIVIANOS } from "./cleanListing.js";

function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

function summarize(prices) {
  const sorted = prices.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const p25 = percentile(sorted, 0.25);
  const p50 = percentile(sorted, 0.5);
  const p75 = percentile(sorted, 0.75);
  return {
    n: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    p25,
    p50,
    p75,
    iqr: p75 - p25,
  };
}

function dealLabel(deltaPct) {
  if (deltaPct == null) return { key: "sin_data", label: "Sin comparables", tone: "zinc" };
  if (deltaPct <= -12) return { key: "oportunidad", label: "Oportunidad", tone: "emerald" };
  if (deltaPct <= -4) return { key: "buen_precio", label: "Buen precio", tone: "lime" };
  if (deltaPct <= 8) return { key: "mercado", label: "Precio de mercado", tone: "sky" };
  return { key: "sobreprecio", label: "Sobreprecio", tone: "rose" };
}

export function cohortKey(row) {
  const brand = fold(row?.brand);
  const model = fold(row?.model);
  const year = Number(row?.year);
  if (!brand || !model || !Number.isFinite(year) || year < 1990) return null;
  return `${brand}|${model}|${year}`;
}

export function buildCohorts(rows) {
  const buckets = new Map();
  for (const row of rows || []) {
    const key = cohortKey(row);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  const cohorts = new Map();
  for (const [key, items] of buckets) {
    const kms = items.map((r) => r.mileage).filter((n) => Number.isFinite(n));
    const kmSorted = [...kms].sort((a, b) => a - b);
    cohorts.set(key, {
      key,
      n: items.length,
      stats: summarize(items.map((r) => r.price)),
      kmMedian: kmSorted.length ? kmSorted[Math.floor(kmSorted.length / 2)] : null,
      items,
    });
  }
  return cohorts;
}

export function attachPeerDeals(rows) {
  const cohorts = buildCohorts(rows);
  return (rows || []).map((row) => {
    const cohort = cohorts.get(cohortKey(row));
    const stats = cohort?.stats || null;
    const n = cohort?.n || 0;
    const deltaPct =
      stats?.p50 && row.price ? Math.round(((row.price - stats.p50) / stats.p50) * 1000) / 10 : null;
    const kmDelta = cohort?.kmMedian != null && row.mileage != null ? row.mileage - cohort.kmMedian : null;
    return {
      ...row,
      market: stats ? { ...stats, n } : row.market || null,
      delta_pct: deltaPct,
      deal: dealLabel(deltaPct),
      peer_n: n,
      peer_km: cohort?.kmMedian ?? null,
      km_vs_peer: kmDelta,
    };
  });
}

export function dominantYear(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    if (!row.year) continue;
    counts.set(row.year, (counts.get(row.year) || 0) + 1);
  }
  let year = null;
  let n = 0;
  for (const [y, c] of counts) {
    if (c > n || (c === n && y > year)) {
      year = y;
      n = c;
    }
  }
  return { year, n };
}

function pickRow(row) {
  if (!row) return null;
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
    city: row.city,
    region: row.region,
    image_url: row.image_url,
    fuel: row.fuel,
    transmission: row.transmission,
    seller_type: row.seller_type,
    delta_pct: row.delta_pct,
    deal: row.deal,
    peer_n: row.peer_n,
    reason: row.reason,
    reasons: row.reasons,
  };
}

export function comparableExtremes(rows, year = null) {
  const list = rows || [];
  const chosen = year ? Number(year) : dominantYear(list).year;
  const peer = chosen ? list.filter((r) => r.year === chosen) : list;
  if (!peer.length) return { year: chosen, n: 0, cheapest: null, expensive: null, rows: [] };
  const cheapest = peer.reduce((a, b) => (a.price < b.price ? a : b));
  const expensive = peer.reduce((a, b) => (a.price > b.price ? a : b));
  return {
    year: chosen,
    n: peer.length,
    cheapest: pickRow(cheapest),
    expensive: pickRow(expensive),
    rows: peer,
  };
}

function reasonFor(row) {
  const bits = [];
  if (row.delta_pct != null) {
    const abs = Math.abs(row.delta_pct);
    bits.push(
      row.delta_pct < 0
        ? `${abs}% bajo la mediana de ${row.brand} ${row.model} ${row.year}`
        : `${abs}% sobre la mediana de ${row.brand} ${row.model} ${row.year}`
    );
  }
  if (row.peer_n) bits.push(`${row.peer_n} avisos del mismo año`);
  if (row.km_vs_peer != null && Math.abs(row.km_vs_peer) >= 8000) {
    const km = Math.round(Math.abs(row.km_vs_peer) / 1000);
    bits.push(row.km_vs_peer < 0 ? `${km} mil km menos que el típico` : `${km} mil km más que el típico`);
  }
  return bits.join(" · ");
}

export function uniqueOpportunities(rows, { limit = 12, minPeers = 5 } = {}) {
  const scored = attachPeerDeals(rows)
    .filter((r) => r.peer_n >= minPeers && r.delta_pct != null && r.delta_pct <= -12)
    .filter((r) => r.km_vs_peer == null || r.km_vs_peer <= 35_000)
    .sort((a, b) => (a.delta_pct ?? 0) - (b.delta_pct ?? 0) || a.price - b.price);
  const seen = new Set();
  const out = [];
  for (const row of scored) {
    const key = cohortKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(pickRow({ ...row, reason: reasonFor(row) }));
    if (out.length >= limit) break;
  }
  return out;
}

export function overpricedPicks(rows, { limit = 12, minPeers = 5 } = {}) {
  const scored = attachPeerDeals(rows)
    .filter((r) => r.peer_n >= minPeers && r.delta_pct != null && r.delta_pct >= 12)
    .sort((a, b) => (b.delta_pct ?? 0) - (a.delta_pct ?? 0));
  const seen = new Set();
  const out = [];
  for (const row of scored) {
    const key = cohortKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(pickRow({ ...row, reason: reasonFor(row) }));
    if (out.length >= limit) break;
  }
  return out;
}

export function pickBestDeal(items) {
  const list = items || [];
  if (!list.length) return null;
  const peers = list.filter((r) => r.delta_pct != null && (r.peer_n || 0) >= 4);
  if (peers.length) return peers.reduce((a, b) => (a.delta_pct < b.delta_pct ? a : b));
  const recent = list.filter((r) => r.year >= 2016);
  const pool = recent.length ? recent : list;
  return pool.reduce((a, b) => (a.price < b.price ? a : b));
}

export function pickWorstDeal(items) {
  const list = items || [];
  if (!list.length) return null;
  const peers = list.filter((r) => r.delta_pct != null && (r.peer_n || 0) >= 4);
  if (peers.length) return peers.reduce((a, b) => (a.delta_pct > b.delta_pct ? a : b));
  const recent = list.filter((r) => r.year >= 2016);
  const pool = recent.length ? recent : list;
  return pool.reduce((a, b) => (a.price > b.price ? a : b));
}

export function recommendBuys(rows, query = {}, { limit = 6 } = {}) {
  let pool = rows || [];
  if (query.budgetMax) pool = pool.filter((r) => r.price <= query.budgetMax);
  if (query.yearMin) pool = pool.filter((r) => r.year >= query.yearMin);
  if (query.yearMax) pool = pool.filter((r) => r.year <= query.yearMax);
  if (query.kmMax) pool = pool.filter((r) => r.mileage != null && r.mileage <= query.kmMax);
  if (query.category) pool = pool.filter((r) => r.category === query.category);
  const scored = attachPeerDeals(pool)
    .map((row) => {
      let score = 0;
      const reasons = [];
      if (row.delta_pct != null) {
        score += -row.delta_pct * 2.2;
        if (row.delta_pct <= -12) reasons.push(`${Math.abs(row.delta_pct)}% bajo pares ${row.year}`);
        else if (row.delta_pct <= -4) reasons.push("Por debajo del precio justo de su año");
      }
      if (row.peer_n >= 8) {
        score += 10;
        reasons.push(`${row.peer_n} comparables del mismo modelo y año`);
      } else if (row.peer_n >= 4) {
        score += 4;
        reasons.push(`${row.peer_n} pares del mismo año`);
      } else {
        score -= 8;
      }
      if (row.km_vs_peer != null && row.km_vs_peer <= -10_000) {
        score += 8;
        reasons.push(`${Math.round(Math.abs(row.km_vs_peer) / 1000)} mil km menos que el típico`);
      }
      if (row.peer_n >= 5 && row.delta_pct <= -15 && (row.km_vs_peer == null || row.km_vs_peer <= 15_000)) {
        score += 14;
        reasons.push("Oportunidad poco frecuente a este precio");
      }
      if (query.intent === "oportunidad" && (row.delta_pct == null || row.delta_pct > -4)) score -= 18;
      if (query.budgetMax && row.price > query.budgetMax * 0.92) score += 2;
      return { ...row, score, reasons, reason: reasons[0] || reasonFor(row) };
    })
    .filter((r) => r.peer_n >= 3 && r.score > 0)
    .sort((a, b) => b.score - a.score || (a.delta_pct ?? 0) - (b.delta_pct ?? 0));

  const seen = new Set();
  const out = [];
  for (const row of scored) {
    const modelKey = `${fold(row.brand)}|${fold(row.model)}`;
    if (seen.has(modelKey)) continue;
    seen.add(modelKey);
    out.push(pickRow(row));
    if (out.length >= limit) break;
  }
  return out;
}

export function parseMoneyCLP(text) {
  const raw = fold(text);
  const mill = raw.match(/(?:hasta|max|maximo|presupuesto|bajo)\s+(\d+(?:[.,]\d+)?)\s*(millones|millon|mill|m|palos)\b/);
  const mill2 = raw.match(/\b(\d{1,2}(?:[.,]\d)?)\s*(millones|millon|mill|palos)\b/);
  const hit = mill || mill2;
  if (hit) {
    const n = Number(String(hit[1]).replace(",", "."));
    if (Number.isFinite(n) && n >= 1 && n <= 200) return Math.round(n * 1_000_000);
  }
  const pesos = String(text || "").match(/\$\s*([\d.]{6,12})/);
  if (pesos) {
    const n = Number(pesos[1].replace(/[^\d]/g, ""));
    if (n >= 800_000) return n;
  }
  return null;
}

export function parseYearRange(text) {
  const range = String(text || "").match(/\b(19[89]\d|20[0-2]\d)\s*[-–/a]\s*(19[89]\d|20[0-2]\d)\b/i);
  if (!range) return { year: null, yearMin: null, yearMax: null };
  let yearMin = Number(range[1]);
  let yearMax = Number(range[2]);
  if (yearMin > yearMax) [yearMin, yearMax] = [yearMax, yearMin];
  return { year: null, yearMin, yearMax, raw: range[0] };
}

export function parseKmMax(text) {
  const raw = fold(text);
  const mil = raw.match(/(?:hasta|max|menos de|bajo)\s+(\d{1,3})\s*mil(?:es)?\s*km/);
  if (mil) return Number(mil[1]) * 1000;
  const km = raw.match(/(?:hasta|max|menos de)\s+([\d.]+)\s*km/);
  if (km) return Number(String(km[1]).replace(/[^\d]/g, ""));
  return null;
}

export function inferCategoryIntent(text) {
  const raw = fold(text);
  if (/\b(suv|crossover|todo terreno|4x4)\b/.test(raw)) return "suv";
  if (/\b(camioneta|pickup|pick up)\b/.test(raw)) return "camioneta";
  if (/\b(citycar|hatch|sedan|sedán)\b/.test(raw)) return "auto";
  if (/\b(furgon|furgón|van comercial)\b/.test(raw)) return "comercial";
  return null;
}

export function buildMarketIntel(rows) {
  const light = (rows || []).filter((r) => LIVIANOS.has(r.category) || r.category === "comercial");
  const headline = light.length ? light : rows || [];
  const decorated = attachPeerDeals(headline);
  const opportunities = uniqueOpportunities(headline, { limit: 12 });
  const overpriced = overpricedPicks(headline, { limit: 12 });
  return {
    decorated,
    opportunities,
    overpriced,
    bestDeal: opportunities[0] || pickRow(pickBestDeal(decorated)),
    worstDeal: overpriced[0] || pickRow(pickWorstDeal(decorated)),
  };
}
