import { parseLocation } from "../server/lib/geo.js";
import { sanitizeListing, matchesKind } from "./cleanListing.js";
import {
  attachPeerDeals,
  comparableExtremes,
  inferCategoryIntent,
  parseKmMax,
  parseMoneyCLP,
  parseYearRange,
  recommendBuys,
  uniqueOpportunities,
} from "./intelligence.js";
import { valueVehicle } from "./valuation.js";
import { generationsFor } from "./catalog.js";

const YEAR_RE = /\b(19[89]\d|20[0-2]\d)\b/;

export function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function dealLabel(deltaPct) {
  if (deltaPct == null) return { key: "sin_data", label: "Sin comparables", tone: "zinc" };
  if (deltaPct <= -12) return { key: "oportunidad", label: "Oportunidad", tone: "emerald" };
  if (deltaPct <= -4) return { key: "buen_precio", label: "Buen precio", tone: "lime" };
  if (deltaPct <= 8) return { key: "mercado", label: "Precio de mercado", tone: "sky" };
  return { key: "sobreprecio", label: "Sobreprecio", tone: "rose" };
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

export function summarize(prices) {
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
  const p25 = percentile(sorted, 0.25);
  const p50 = percentile(sorted, 0.5);
  const p75 = percentile(sorted, 0.75);
  return {
    n: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(sum / sorted.length),
    p25,
    p50,
    p75,
    iqr: p75 - p25,
  };
}

/** Yapo a veces deja un dígito extra (397900001 → 39.790.000). */
export { sanitizePrice as cleanPrice } from "./cleanListing.js";

export function withCleanPrice(row) {
  return sanitizeListing(row, parseLocation);
}

function tokens(text) {
  return fold(text).split(" ").filter(Boolean);
}

export function parseVehicleQuery(text, facets = {}) {
  const raw = fold(text);
  const range = parseYearRange(text);
  const yearHit = !range.yearMin ? raw.match(YEAR_RE) : null;
  const year = range.yearMin ? null : yearHit ? Number(yearHit[1]) : null;
  let rest = raw;
  if (range.raw) rest = fold(String(text || "").replace(range.raw, " "));
  else if (yearHit) rest = rest.replace(yearHit[0], " ");
  rest = rest
    .replace(/\b\d{1,3}(?:\.\d{3})*\s*km\b/g, " ")
    .replace(/\b\d+\s*mil\b/g, " ")
    .replace(/\b(hasta|max|maximo|presupuesto|menos de|bajo)\b/g, " ")
    .replace(/\b(millones|millon|mill|palos)\b/g, " ")
    .replace(/\b(suv|crossover|camioneta|pickup|familiar|oportunidad|oferta|barato|unico|unica)\b/g, " ")
    .replace(/\b\d{1,2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const brandValues = (facets.brands || []).map((b) => b.value).filter(Boolean);
  brandValues.sort((a, b) => fold(b).length - fold(a).length);

  let brand = "";
  for (const name of brandValues) {
    const fb = fold(name);
    if (!fb) continue;
    if (rest === fb || rest.startsWith(`${fb} `) || rest.endsWith(` ${fb}`) || rest.includes(` ${fb} `)) {
      brand = name;
      rest = rest.replace(fb, " ").replace(/\s+/g, " ").trim();
      break;
    }
  }

  let model = rest;
  if (!brand && model) {
    const hits = (facets.models || []).filter((m) => {
      const fm = fold(m.value);
      return fm === model || fm.startsWith(`${model} `) || model.startsWith(fm);
    });
    const unique = [...new Set(hits.map((h) => h.brand).filter(Boolean))];
    if (unique.length === 1) {
      brand = unique[0];
      const exact = hits.find((h) => fold(h.value) === model) || hits[0];
      if (exact) model = exact.value;
    }
  }

  if (model) {
    const hit = (facets.models || []).find((m) => {
      if (brand && m.brand && fold(m.brand) !== fold(brand)) return false;
      return fold(m.value) === fold(model);
    });
    if (hit) model = hit.value;
  }

  return {
    q: String(text || "").trim(),
    brand,
    model,
    year,
    yearMin: range.yearMin,
    yearMax: range.yearMax,
  };
}

export function parseSmartQuery(text, facets = {}) {
  const base = parseVehicleQuery(text, facets);
  const budgetMax = parseMoneyCLP(text);
  const kmMax = parseKmMax(text);
  const category = inferCategoryIntent(text);
  const intent = /oportun|oferta|barat|remate|unica|único|unico/.test(fold(text)) ? "oportunidad" : "tasar";
  return { ...base, budgetMax, kmMax, category, intent };
}

function modelMatches(row, wanted) {
  if (!wanted) return true;
  const fm = fold(wanted);
  const rm = fold(row.model);
  const rt = fold(row.title);
  const rv = fold(row.version);
  if (!fm) return true;
  if (rm === fm || rt === fm) return true;
  if (rm.startsWith(fm) || (fm.startsWith(rm) && rm.length >= 3)) return true;
  if (rm.includes(fm) || fm.includes(rm) && rm.length >= 3) return true;
  const wt = tokens(wanted);
  const hay = `${rm} ${rt} ${rv}`;
  return wt.every((t) => t.length < 2 || hay.includes(t));
}

function brandMatches(row, wanted) {
  if (!wanted) return true;
  const fb = fold(wanted);
  return fold(row.brand) === fb || fold(row.title).startsWith(fb);
}

export function matchListings(rows, query = {}) {
  const brand = query.brand || "";
  const model = query.model || "";
  const year = query.year ? Number(query.year) : null;
  const yearMin = query.yearMin ? Number(query.yearMin) : null;
  const yearMax = query.yearMax ? Number(query.yearMax) : null;
  const kind = query.kind || "livianos";
  let matched = rows.map((row) => sanitizeListing(row, parseLocation)).filter(Boolean).filter((row) => {
    if (!matchesKind(row, kind)) return false;
    if (query.category && row.category !== query.category) return false;
    if (brand && !brandMatches(row, brand)) return false;
    if (model && !modelMatches(row, model)) return false;
    if (!brand && !model && query.q && !query.category && !query.budgetMax) {
      const q = fold(query.q).replace(YEAR_RE, " ").trim();
      const hay = fold(`${row.brand} ${row.model} ${row.title}`);
      if (q && !tokens(q).every((t) => t.length < 2 || hay.includes(t))) return false;
    }
    return true;
  });

  let scope = model || brand ? "todos los años del modelo" : query.category ? `categoría ${query.category}` : "búsqueda libre";
  if (yearMin || yearMax) {
    const lo = yearMin || 1990;
    const hi = yearMax || 2027;
    matched = matched.filter((r) => r.year >= lo && r.year <= hi);
    scope = `años ${lo}–${hi}`;
  } else if (year) {
    const exact = matched.filter((r) => r.year === year);
    const near = matched.filter((r) => r.year && Math.abs(r.year - year) <= 1);
    if (exact.length >= 3) {
      matched = exact;
      scope = `año ${year}`;
    } else if (near.length >= 3) {
      matched = near;
      scope = `año ${year} ± 1`;
    } else if (exact.length) {
      matched = exact;
      scope = `año ${year} (pocos avisos)`;
    } else if (near.length) {
      matched = near;
      scope = `año ${year} ± 1 (pocos avisos)`;
    } else {
      matched = [];
      scope = `año ${year} (sin avisos)`;
    }
  }
  const kmMax = query.kmMax ? Number(query.kmMax) : null;
  if (kmMax && Number.isFinite(kmMax) && kmMax > 0 && matched.length) {
    const capped = matched.filter((r) => r.mileage != null && r.mileage <= kmMax);
    if (capped.length) {
      matched = capped;
      scope += ` · hasta ${Math.round(kmMax / 1000)} mil km`;
    }
  } else {
    const km = query.mileage ? Number(query.mileage) : null;
    if (km && Number.isFinite(km) && km > 0 && matched.length) {
      const band = Math.max(20_000, km * 0.3);
      const nearKm = matched.filter((r) => r.mileage != null && Math.abs(r.mileage - km) <= band);
      if (nearKm.length) {
        matched = nearKm;
        scope += ` · ~${Math.round(km / 1000)} mil km`;
      }
    }
  }
  const budgetMax = query.budgetMax ? Number(query.budgetMax) : null;
  if (budgetMax && matched.length) {
    const under = matched.filter((r) => r.price <= budgetMax);
    if (under.length) {
      matched = under;
      scope += ` · hasta ${new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(budgetMax)}`;
    }
  }
  return { rows: matched, scope };
}

function pick(row) {
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
  };
}

function groupStats(list, keyFn) {
  const map = new Map();
  for (const row of list) {
    const key = keyFn(row) || "Sin dato";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return [...map.entries()]
    .map(([name, items]) => {
      const prices = items.map((r) => r.price).sort((a, b) => a - b);
      const min = items.reduce((a, b) => (a.price < b.price ? a : b));
      const max = items.reduce((a, b) => (a.price > b.price ? a : b));
      return {
        name,
        n: items.length,
        min_price: prices[0],
        max_price: prices[prices.length - 1],
        median: prices[Math.floor(prices.length / 2)],
        avg_price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        cheapest: pick(min),
        expensive: pick(max),
      };
    })
    .sort((a, b) => b.n - a.n);
}

function decorateRow(row, market) {
  const deltaPct =
    market?.p50 && row.price ? Math.round(((row.price - market.p50) / market.p50) * 1000) / 10 : null;
  return { ...row, market, delta_pct: deltaPct, deal: dealLabel(deltaPct) };
}

export function buildVehicleReport(allRows, query = {}) {
  const smart = parseSmartQuery(query.q || "", query.facets || {});
  const parsed = {
    brand: query.brand || smart.brand || "",
    model: query.model || smart.model || "",
    year: query.year ? Number(query.year) : smart.year,
    yearMin: query.yearMin || smart.yearMin,
    yearMax: query.yearMax || smart.yearMax,
    mileage: query.mileage ? Number(query.mileage) : null,
    kmMax: query.kmMax || smart.kmMax,
    budgetMax: query.budgetMax || smart.budgetMax,
    category: query.category || smart.category,
    intent: query.intent || smart.intent,
    version: query.version || "",
    fuel: query.fuel || "",
    transmission: query.transmission || "",
    rules: query.rules || {},
    kind: query.kind || "livianos",
    q: query.q || "",
  };
  if (!parsed.brand && !parsed.model && parsed.q) {
    parsed.brand = smart.brand;
    parsed.model = smart.model;
    parsed.year = parsed.year || smart.year;
  }

  const { rows, scope } = matchListings(allRows, parsed);
  const statsAll = summarize(rows.map((r) => r.price));
  const inBand = statsAll
    ? rows.filter((r) => r.price >= statsAll.min && r.price <= statsAll.max)
    : rows;

  const peerYear = parsed.year || (parsed.yearMin && parsed.yearMax && parsed.yearMin === parsed.yearMax ? parsed.yearMin : null);
  const extremes = comparableExtremes(inBand, peerYear);
  const peerRows = extremes.rows?.length ? extremes.rows : inBand;
  const peerStats = summarize(peerRows.map((r) => r.price)) || statsAll;
  const cheapest = extremes.cheapest;
  const expensive = extremes.expensive;

  let sample = peerRows;
  if (parsed.mileage && peerRows.length >= 8) {
    const km = parsed.mileage;
    const close = peerRows.filter((r) => r.mileage && Math.abs(r.mileage - km) <= Math.max(25000, km * 0.35));
    if (close.length >= 5) sample = close;
  }
  const kmStats = sample === peerRows ? peerStats : summarize(sample.map((r) => r.price));

  const byYear = groupStats(
    inBand.filter((r) => r.year >= 2005 && r.year <= 2027),
    (r) => r.year
  )
    .map((g) => ({ ...g, year: Number(g.name) }))
    .sort((a, b) => a.year - b.year);

  const kmBuckets = [
    [0, 30000, "0–30 mil"],
    [30000, 60000, "30–60 mil"],
    [60000, 100000, "60–100 mil"],
    [100000, 150000, "100–150 mil"],
    [150000, 250000, "150–250 mil"],
    [250000, 1e9, "250 mil+"],
  ];
  const byKm = kmBuckets
    .map(([, , label], i) => {
      const [lo, hi] = kmBuckets[i];
      const items = peerRows.filter((r) => r.mileage != null && r.mileage >= lo && r.mileage < hi);
      if (!items.length) return null;
      const prices = items.map((r) => r.price).sort((a, b) => a - b);
      return {
        name: label,
        n: items.length,
        median: prices[Math.floor(prices.length / 2)],
        min_price: prices[0],
        max_price: prices[prices.length - 1],
      };
    })
    .filter(Boolean);

  const scatter = peerRows
    .filter((r) => r.mileage != null && r.mileage > 0 && r.mileage < 400000)
    .slice()
    .sort((a, b) => a.mileage - b.mileage)
    .slice(0, 220)
    .map((r) => ({
      mileage: r.mileage,
      price: r.price,
      year: r.year,
      label: `${r.year || ""} ${r.brand || ""} ${r.model || ""}`.trim(),
    }));

  const decorated = attachPeerDeals(inBand);
  const listings = decorated
    .slice()
    .sort((a, b) => (a.delta_pct ?? 99) - (b.delta_pct ?? 99) || a.price - b.price)
    .slice(0, 60);

  const opportunities = uniqueOpportunities(inBand, { limit: 8, minPeers: 4 });
  const recommendations = recommendBuys(inBand, parsed, { limit: 5 });
  const used = kmStats || peerStats;
  const valuation = valueVehicle(allRows, {
    ...parsed,
    year: parsed.year || extremes.year,
  });
  const generation = query.catalog ? generationsFor(query.catalog, parsed.brand, parsed.model) : null;
  const yearLabel = extremes.year ? `año ${extremes.year}` : "mismo modelo";
  const insight = extremes.year
    ? `Más barato y más caro se comparan en el ${yearLabel} (${extremes.n} avisos). No mezclamos un auto viejo con uno nuevo.`
    : "Necesitamos marca y modelo para comparar pares del mismo año.";

  const citySource = extremes.year ? peerRows : inBand;

  return {
    query: parsed,
    label: [parsed.brand, parsed.model, parsed.year || (parsed.yearMin && parsed.yearMax ? `${parsed.yearMin}–${parsed.yearMax}` : "")].filter(Boolean).join(" ") || parsed.q || "Vehículo",
    sample: inBand.length,
    peer_n: extremes.n,
    peer_year: extremes.year,
    scope: extremes.year && !parsed.year && !parsed.yearMin ? `${scope} · comparables ${yearLabel}` : scope,
    insight,
    stats: used,
    band: used ? { low: used.p25, mid: used.p50, high: used.p75 } : null,
    suggested_buy: valuation.buy || (used ? Math.round(used.p25 * 0.88) : null),
    suggested_list: valuation.retail || (used ? Math.round(used.p50) : null),
    valuation,
    generation,
    cheapest,
    expensive,
    byYear,
    byKm,
    byRegion: groupStats(citySource, (r) => r.region).slice(0, 12),
    byCity: groupStats(citySource, (r) => r.city).filter((g) => g.name !== "Sin dato").slice(0, 16),
    bySource: groupStats(inBand, (r) => r.source),
    byFuel: groupStats(inBand, (r) => r.fuel).filter((g) => g.name !== "Sin dato").slice(0, 6),
    byTransmission: groupStats(inBand, (r) => r.transmission).filter((g) => g.name !== "Sin dato").slice(0, 6),
    scatter,
    listings,
    opportunities,
    recommendations,
  };
}

export function filterListings(rows, filters = {}) {
  const q = fold(filters.q);
  const yearMin = filters.year_min ? Number(filters.year_min) : null;
  const yearMax = filters.year_max ? Number(filters.year_max) : null;
  const priceMin = filters.price_min ? Number(filters.price_min) : null;
  const priceMax = filters.price_max ? Number(filters.price_max) : null;
  const kmMax = filters.km_max ? Number(filters.km_max) : null;
  let out = rows.map((row) => sanitizeListing(row, parseLocation)).filter(Boolean).filter((row) => {
    if (filters.kind && !matchesKind(row, filters.kind)) return false;
    if (filters.brand && fold(row.brand) !== fold(filters.brand)) return false;
    if (filters.model && !modelMatches(row, filters.model)) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (filters.source && row.source !== filters.source) return false;
    if (filters.region && row.region !== filters.region) return false;
    if (filters.city && row.city !== filters.city) return false;
    if (yearMin && !(row.year >= yearMin)) return false;
    if (yearMax && !(row.year <= yearMax)) return false;
    if (priceMin && !(row.price >= priceMin)) return false;
    if (priceMax && !(row.price <= priceMax)) return false;
    if (kmMax && !(row.mileage != null && row.mileage <= kmMax)) return false;
    if (q) {
      const hay = fold(`${row.brand} ${row.model} ${row.title} ${row.version || ""}`);
      if (!tokens(q).every((t) => t.length < 2 || hay.includes(t))) return false;
    }
    return true;
  });

  const sortMap = {
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    year_desc: (a, b) => (b.year || 0) - (a.year || 0),
    km_asc: (a, b) => (a.mileage ?? 9e9) - (b.mileage ?? 9e9),
    recent: (a, b) => String(b.last_seen || b.id).localeCompare(String(a.last_seen || a.id)),
  };
  out.sort(sortMap[filters.sort] || sortMap.recent);
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(60, Math.max(10, Number(filters.limit) || 24));
  const decorated = attachPeerDeals(out);
  const total = decorated.length;
  const rowsPage = decorated.slice((page - 1) * limit, page * limit);
  return { total, page, limit, rows: rowsPage };
}

export function suggestVehicles(facets, text) {
  const q = fold(text);
  const models = facets?.models || [];
  const scored = models
    .map((m) => {
      const label = `${m.brand || ""} ${m.value || ""}`.trim();
      const fl = fold(label);
      let score = 0;
      if (!q) score = m.n || 0;
      else if (fl.startsWith(q)) score = 1000 + (m.n || 0);
      else if (fl.includes(q)) score = 500 + (m.n || 0);
      else if (tokens(q).every((t) => fl.includes(t))) score = 200 + (m.n || 0);
      return { brand: m.brand, model: m.value, n: m.n, label, score };
    })
    .filter((s) => s.score > 0 && s.brand && s.model && !/^(de|con|para|moto|electrica)$/i.test(s.model));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, q ? 8 : 6);
}
