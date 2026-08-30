/** Motor de tasación: tres precios, km, versión, reglas y confianza. Usa avisos propios. */

import { matchesKind } from "./cleanListing.js";

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

function median(values) {
  const s = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.floor(s.length / 2)];
}

export function summarizePrices(prices) {
  let sorted = prices.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  if (sorted.length >= 8) {
    const q1 = percentile(sorted, 0.25);
    const q3 = percentile(sorted, 0.75);
    const fence = (q3 - q1) * 3;
    const clipped = sorted.filter((n) => n >= q1 - fence && n <= q3 + fence);
    if (clipped.length >= 5) sorted = clipped;
  }
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

const TRIM = [
  "gt", "gti", "gtd", "allure", "active", "trend", "trendline", "highline", "comfort",
  "exclusive", "sport", "lx", "ex", "gls", "limited", "premium", "style", "sense",
  "advance", "ambition", "elegance", "luxury", "connect", "pack",
];

export function versionTokens(row = {}) {
  const hay = fold([row.version, row.title, row.fuel, row.transmission, row.drivetrain, row.queryVersion].filter(Boolean).join(" "));
  const tokens = new Set();
  if (/\b(diesel|tdi|hdi|dci|crd|tdci|cdti)\b/.test(hay)) tokens.add("diesel");
  if (/\b(bencina|gasolina|nafta|tfsi|tsi|gdi|mpi)\b/.test(hay)) tokens.add("bencina");
  if (/\b(hybrid|hibrido|phev|hev)\b/.test(hay)) tokens.add("hibrido");
  if (/\b(electric|ev\b)\b/.test(hay)) tokens.add("electrico");
  if (/\b(automatic|cvt|dsg|tiptronic|eat|at\b|s tronic|stronic)\b/.test(hay)) tokens.add("at");
  if (/\b(manual|mecanic|mt\b)\b/.test(hay)) tokens.add("mt");
  if (/\b(4x4|4wd|awd|quattro|4matic|xdrive)\b/.test(hay)) tokens.add("4x4");
  if (/\b(4x2|2wd|fwd)\b/.test(hay)) tokens.add("4x2");
  const cc = hay.match(/\b([1-6][.,][0-9])\b/);
  if (cc) tokens.add(cc[1].replace(",", "."));
  for (const t of TRIM) {
    if (new RegExp(`\\b${t}\\b`).test(hay)) tokens.add(t);
  }
  return tokens;
}

export function versionOverlap(a, b) {
  if (!a?.size || !b?.size) return 0;
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n / Math.max(a.size, b.size);
}

function brandOk(row, brand) {
  if (!brand) return true;
  return fold(row.brand) === fold(brand);
}

function modelOk(row, model) {
  if (!model) return true;
  const want = fold(model);
  const have = fold(row.model);
  const title = fold(row.title);
  if (!want) return true;
  if (have === want || title.includes(want)) return true;
  if (have.startsWith(want) || (want.startsWith(have) && have.length >= 3)) return true;
  return want.split(" ").every((t) => t.length < 2 || have.includes(t) || title.includes(t));
}

export function kmRegression(rows) {
  const pts = (rows || []).filter((r) => r.mileage > 2000 && r.mileage < 320000 && r.price > 500000);
  const medianKm = median(pts.map((r) => r.mileage));
  if (pts.length < 6) return { slope: 0, medianKm, n: pts.length };
  const mx = pts.reduce((a, r) => a + r.mileage, 0) / pts.length;
  const my = pts.reduce((a, r) => a + r.price, 0) / pts.length;
  let num = 0;
  let den = 0;
  for (const r of pts) {
    num += (r.mileage - mx) * (r.price - my);
    den += (r.mileage - mx) ** 2;
  }
  const raw = den ? num / den : 0;
  const slope = Math.max(-220, Math.min(0, raw));
  return { slope, medianKm, n: pts.length };
}

export function daysListed(row) {
  const a = row.first_seen || row.last_seen;
  const b = row.last_seen || row.first_seen;
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.max(0, Math.round(ms / 86400000));
}

export function selectComps(rows, query = {}) {
  const brand = query.brand || "";
  const model = query.model || "";
  const year = query.year ? Number(query.year) : null;
  const yearMin = query.yearMin ? Number(query.yearMin) : null;
  const yearMax = query.yearMax ? Number(query.yearMax) : null;
  const wanted = versionTokens({
    version: query.version,
    fuel: query.fuel,
    transmission: query.transmission,
    drivetrain: query.drivetrain,
    queryVersion: query.version,
  });

  let pool = (rows || []).filter((r) => r.price > 0 && brandOk(r, brand) && modelOk(r, model));
  if (query.kind && query.kind !== "all") pool = pool.filter((r) => matchesKind(r, query.kind));
  if (query.category) pool = pool.filter((r) => r.category === query.category);
  if (query.fuel) pool = pool.filter((r) => fold(r.fuel).includes(fold(query.fuel)) || versionTokens(r).has(fold(query.fuel) === "diesel" ? "diesel" : fold(query.fuel)));
  if (query.transmission) {
    const at = /auto/i.test(query.transmission);
    pool = pool.filter((r) => {
      const t = fold(r.transmission);
      return at ? /auto|cvt|dsg/.test(t) : /manual|mecanic/.test(t);
    });
  }

  const layers = [];
  if (year) {
    const exact = pool.filter((r) => r.year === year);
    layers.push({ rows: exact, scope: `año ${year}`, yearExact: true });
    layers.push({ rows: pool.filter((r) => r.year && Math.abs(r.year - year) <= 1), scope: `año ${year} ± 1`, yearExact: false });
  } else if (yearMin || yearMax) {
    const lo = yearMin || 1990;
    const hi = yearMax || 2027;
    layers.push({ rows: pool.filter((r) => r.year >= lo && r.year <= hi), scope: `años ${lo}–${hi}`, yearExact: false });
  }
  layers.push({ rows: pool, scope: model || brand ? "todos los años del modelo" : "marca", yearExact: false });

  let chosen = { rows: [], scope: "sin pares", yearExact: false, versionMatched: false };
  for (const layer of layers) {
    if (layer.rows.length < 3) continue;
    if (wanted.size) {
      const scored = layer.rows
        .map((r) => ({ r, ov: versionOverlap(wanted, versionTokens(r)) }))
        .filter((x) => x.ov >= 0.25);
      if (scored.length >= 3) {
        chosen = {
          rows: scored.sort((a, b) => b.ov - a.ov).slice(0, 80).map((x) => x.r),
          scope: `${layer.scope} · versión`,
          yearExact: layer.yearExact,
          versionMatched: true,
        };
        break;
      }
    }
    if (layer.rows.length >= 3) {
      chosen = { ...layer, versionMatched: false };
      break;
    }
  }
  if (!chosen.rows.length && pool.length) {
    chosen = { rows: pool.slice(0, 80), scope: "muestra amplia (pocos pares)", yearExact: false, versionMatched: false };
  }
  return chosen;
}

function confidenceOf({ n, stats, yearExact, versionMatched, scope }) {
  const iqrPct = stats?.p50 ? stats.iqr / stats.p50 : 1;
  let score = 20;
  if (n >= 20) score += 35;
  else if (n >= 12) score += 28;
  else if (n >= 8) score += 18;
  else if (n >= 5) score += 10;
  if (yearExact) score += 20;
  if (versionMatched) score += 12;
  if (iqrPct < 0.12) score += 15;
  else if (iqrPct < 0.2) score += 8;
  else if (iqrPct > 0.35) score -= 15;
  if (!yearExact) score -= 8;
  if (String(scope || "").includes("amplia")) score -= 15;
  score = Math.max(0, Math.min(100, score));
  const level = score >= 72 ? "alta" : score >= 48 ? "media" : "baja";
  const notes = [];
  notes.push(`${n} avisos comparables`);
  if (yearExact) notes.push("mismo año modelo");
  else notes.push("se ampliaron años por falta de muestra");
  if (versionMatched) notes.push("filtrado por versión / motor / cambio");
  if (String(scope || "").includes("amplia")) notes.push("pocos pares: muestra amplia");
  if (iqrPct >= 0.3) notes.push("banda ancha: hay mucha dispersión de precio");
  return { level, score, n, iqr_pct: Math.round(iqrPct * 1000) / 10, notes };
}

function applyRules(price, rules = {}) {
  let factor = 1;
  const applied = [];
  if (rules.unico_dueno) {
    factor += 0.03;
    applied.push("único dueño +3%");
  }
  if (rules.choque) {
    factor -= 0.08;
    applied.push("choque / reparación −8%");
  }
  if (rules.automatico) {
    factor += 0.02;
    applied.push("automático +2%");
  }
  if (rules.manual) {
    factor -= 0.015;
    applied.push("manual −1,5%");
  }
  if (rules.region_rm) {
    factor += 0.03;
    applied.push("Región Metropolitana +3%");
  }
  if (rules.region_otra) {
    factor -= 0.03;
    applied.push("región fuera de RM −3%");
  }
  return { price: Math.round(price * factor), factor, applied };
}

const ASK_TO_CLOSE = 0.94;

export function valueVehicle(allRows, query = {}) {
  const picked = selectComps(allRows, query);
  const comps = picked.rows;
  const stats = summarizePrices(comps.map((r) => r.price));
  if (!stats) {
    return {
      sample: 0,
      confidence: { level: "baja", score: 0, n: 0, iqr_pct: null, notes: ["Sin comparables"] },
      disclaimer: "Precio pedido en portales, no precio de transferencia.",
    };
  }

  const km = query.mileage ? Number(query.mileage) : null;
  const reg = kmRegression(comps);
  let kmAdjust = 0;
  if (km && reg.medianKm && reg.slope) {
    kmAdjust = Math.round((km - reg.medianKm) * reg.slope);
    const cap = Math.round(stats.p50 * 0.18);
    kmAdjust = Math.max(-cap, Math.min(cap, kmAdjust));
  }

  const retailBase = Math.max(stats.min, stats.p50 + kmAdjust);
  const days = comps.map(daysListed).filter((n) => n != null);
  const medianDays = days.length >= 3 ? median(days) : null;
  let buyFactor = 0.88;
  let liqNote = "Sin historial de permanencia suficiente";
  if (medianDays != null) {
    if (medianDays >= 45) {
      buyFactor = 0.86;
      liqNote = `El modelo tarda ~${medianDays} días en vitrina: retoma más conservadora`;
    } else if (medianDays <= 14) {
      buyFactor = 0.91;
      liqNote = `Se mueve rápido (~${medianDays} días): menos margen de compra`;
    } else {
      buyFactor = 0.88;
      liqNote = `Permanencia típica ~${medianDays} días`;
    }
  }

  const ruledRetail = applyRules(retailBase, query.rules);
  const retail = ruledRetail.price;
  const buy = Math.round(Math.min(stats.p25, retail * buyFactor));
  const ceiling = Math.round(Math.min(stats.p25 * 1.02, retail * 0.96));
  const closeEst = Math.round(retail * ASK_TO_CLOSE);

  return {
    sample: stats.n,
    stats,
    band: { low: stats.p25, mid: stats.p50, high: stats.p75 },
    retail,
    buy,
    ceiling,
    close_est: closeEst,
    suggested_buy: buy,
    suggested_list: retail,
    km: {
      input: km,
      median_peer: reg.medianKm,
      slope_per_km: Math.round(reg.slope),
      adjust: kmAdjust,
      n: reg.n,
    },
    liquidity: { median_days: medianDays, note: liqNote, buy_factor: buyFactor },
    confidence: confidenceOf({
      n: stats.n,
      stats,
      yearExact: picked.yearExact,
      versionMatched: picked.versionMatched,
      scope: picked.scope,
    }),
    scope: picked.scope,
    version_matched: picked.versionMatched,
    rules_applied: ruledRetail.applied,
    disclaimer: "Estos son precios pedidos en portales (ask), no transferencias escrituradas. El cierre estimado (~6% bajo publicar) es un factor empírico, no un dato del Registro Civil.",
    query: {
      brand: query.brand || null,
      model: query.model || null,
      year: query.year ? Number(query.year) : null,
      mileage: km,
      version: query.version || null,
    },
  };
}

export { ASK_TO_CLOSE };
