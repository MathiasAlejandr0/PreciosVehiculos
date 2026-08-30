/** Precio, geo, marca y categoría: una pasada para avisos sucios (Yapo, Autocosmos, ML). */

export const LIVIANOS = new Set(["auto", "suv", "camioneta"]);
export const CURRENT_YEAR = 2026;
export const MAX_YEAR = CURRENT_YEAR + 1;

const JUNK_BRANDS = new Set([
  "moto", "motos", "motocicleta", "cuatrimoto", "triciclo", "tlriciclo",
  "bicicleta", "bici", "bicimoto", "silla", "torito", "semi", "de", "con",
  "para", "todo", "dos", "aro", "carga", "agricola", "kiosko", "cocina",
  "cabina", "bebrave", "atv", "electrica", "electrico", "elctrico", "hibrido",
  "sport", "power", "morini", "abm", "duo", "raptor", "110cc", "125cc", "150cc",
  "300cc", "800w", "chile", "usado", "usados", "auto", "autos",
  "bicimot", "wenmotors", "znen", "znen group",
]);

const JUNK_MODELS = new Set([
  "electrica", "electrico", "de", "con", "para", "cabina", "kiosko", "torito",
  "110cc", "125cc", "150cc", "hummer", "moto", "bike", "negra",
]);

function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isJunkBrand(brand) {
  const f = fold(brand);
  if (!f) return true;
  if (JUNK_BRANDS.has(f)) return true;
  if (/^\d/.test(f)) return true;
  return f.length < 2;
}

export function priceCap(category) {
  if (category === "camion") return 280_000_000;
  if (category === "moto") return 25_000_000;
  if (category === "comercial") return 90_000_000;
  return 85_000_000;
}

export function priceFloor(category) {
  if (category === "moto") return 250_000;
  if (category === "camion") return 1_000_000;
  return 800_000;
}

export function priceAllowed(price, category) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return false;
  return n >= priceFloor(category) && n <= priceCap(category);
}

/** Yapo deja un dígito de ranking (17.580.001 → 17.580.000; 397.900.001 → 39.790.000). */
const LUXURY = new Set([
  "bmw", "mercedes", "mercedes-benz", "audi", "porsche", "land rover",
  "lexus", "maserati", "ferrari", "tesla", "bentley", "rolls-royce",
]);

export function inferCategory(row) {
  const hay = `${row.url || ""} ${row.image_url || ""} ${row.title || ""} ${row.model || ""} ${row.category || ""}`.toLowerCase();
  if (/\/bike\/|moto\.mercadolibre|\/motos|mini.?bike|bicimoto|cuatrimoto|\bscooter\b|\benduro\b|\bnaked\b|\batv\b|\b\d{2,4}\s*cc\b|\b\d{2,4}w\b/.test(hay)) {
    return "moto";
  }
  if (/\b(arocs|actros|atego|axor|constellation|busscar|marcopolo|volksbus|fvr|nqr|npr|tracto|camion\b|camión|truck|bus\b)\b/.test(hay)) {
    return "camion";
  }
  if (LIVIANOS.has(row.category) || row.category === "comercial" || row.category === "moto" || row.category === "camion") {
    return row.category;
  }
  return row.category || "auto";
}

export function sanitizePrice(price, category = "auto", title = "", brand = "", year = null) {
  let n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return null;

  const hay = String(title || "");
  if (/pie\s*:?/i.test(hay)) {
    const amounts = [...hay.matchAll(/\$\s*([\d.\s]+)/g)]
      .map((m) => Number(String(m[1]).replace(/[^\d]/g, "")))
      .filter((x) => Number.isFinite(x) && x >= 500_000);
    if (amounts.length >= 2) n = Math.max(...amounts);
    else if (amounts.length === 1 && amounts[0] < 5_000_000) return null;
  }

  n = Math.round(n);
  const s = String(n);
  if (s.length >= 7 && /[1-9]$/.test(s)) {
    n = Math.floor(n / 10) * 10;
  }

  const listed = [...hay.matchAll(/\$\s*([\d.\s]+)/g)]
    .map((m) => Number(String(m[1]).replace(/[^\d]/g, "")))
    .filter((x) => Number.isFinite(x) && x >= 800_000 && x <= 85_000_000);
  if (listed.length) {
    const closest = listed.reduce((a, b) => (Math.abs(a - n) < Math.abs(b - n) ? a : b));
    if (n >= closest * 8 && n <= closest * 15) n = closest;
  }

  const fb = fold(brand);
  const modelHay = `${title} ${brand}`.toLowerCase();
  const keepHigh = LUXURY.has(fb) || fb.includes("mercedes") || /\b(r8|raptor|f-?150|silverado|tahoe|suburban|cayenne|macan|x5|x6|x7|gle|gls|range rover|defender|land cruiser|urus|g 63|mustang)\b/i.test(modelHay);
  if (LIVIANOS.has(category) && n >= 45_000_000 && !keepHigh) {
    n = Math.round(n / 10);
  }

  const cap = priceCap(category);
  const floor = priceFloor(category);
  while (n > cap && n >= floor * 10) n = Math.round(n / 10);
  if (n < floor || n > cap) return null;
  return n;
}

export function sanitizeYear(year) {
  const n = Number(year);
  if (!Number.isFinite(n)) return null;
  if (n < 1990 || n > MAX_YEAR) return null;
  return n;
}

export function sanitizeKm(km) {
  if (km == null || km === "") return null;
  const n = Number(km);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > 500_000) return null;
  return Math.round(n);
}

export function sanitizeModel(brand, model, title = "") {
  let m = String(model || "").trim();
  const fb = fold(brand);
  let fm = fold(m);
  if (fb.includes("mercedes") && (fm.startsWith("benz ") || fm === "benz")) {
    m = m.replace(/^benz\s+/i, "").trim();
    fm = fold(m);
  }
  if (fb.includes("great wall") && (fm.startsWith("wall ") || fm === "wall")) {
    m = m.replace(/^wall\s+/i, "").trim();
    fm = fold(m);
  }
  if (!m && title && brand) {
    const idx = fold(title).indexOf(fb);
    if (idx >= 0) {
      const rest = String(title).slice(idx + brand.length).replace(/^[\s\-]+/, "");
      const token = rest.split(/[\s\/]+/).filter(Boolean)[0];
      if (token && !/^\d{4}$/.test(token)) m = token;
    }
  }
  if (JUNK_MODELS.has(fold(m))) return null;
  return m || null;
}

export function kindOf(category) {
  if (category === "moto") return "moto";
  if (category === "camion") return "camion";
  if (LIVIANOS.has(category) || category === "comercial") return "livianos";
  return "livianos";
}

export function matchesKind(row, kind) {
  if (!kind || kind === "all") return true;
  if (kind === "livianos") return LIVIANOS.has(row.category) || row.category === "comercial";
  if (kind === "moto") return row.category === "moto";
  if (kind === "camion") return row.category === "camion";
  return true;
}

/**
 * Devuelve el aviso limpio o null si no es usable para tasar.
 * No toca url/id. Reaplica geo si se pasa parseLocation.
 */
export function sanitizeListing(row, parseLocation) {
  if (!row || !row.price) return null;
  const title = row.title || "";
  const brand = isJunkBrand(row.brand) ? null : row.brand;
  if (!brand) return null;

  const category = inferCategory({ ...row, title });
  const year = sanitizeYear(row.year);
  const price = sanitizePrice(row.price, category, title, brand, year);
  if (!price) return null;

  const model = sanitizeModel(brand, row.model, title);
  const mileage = sanitizeKm(row.mileage);

  let region = row.region || null;
  let city = row.city || null;
  if (typeof parseLocation === "function") {
    const loc = parseLocation([row.city, row.region].filter(Boolean).join(" | "));
    region = loc.region;
    city = loc.city;
  } else {
    if (region && /^(chile|sin (dato|region)|n\/?d)$/i.test(String(region).trim())) region = null;
    if (city && /^(chile|sin (dato|region)|n\/?d|region metropolitana)$/i.test(String(city).trim())) city = null;
    if (region && city && fold(region) === fold(city)) {
      /* comuna guardada como región: se corrige en parseLocation del servidor */
    }
  }

  return {
    ...row,
    brand,
    model,
    year,
    mileage,
    price,
    region,
    city,
    category,
  };
}

export function facetsFromRows(rows) {
  function tally(keyFn, withBrand = false) {
    const map = new Map();
    for (const row of rows) {
      const value = keyFn(row);
      if (!value) continue;
      const key = withBrand ? `${row.brand}|${row.model || ""}|${value}` : value;
      const prev = map.get(key) || { value, n: 0, brand: row.brand, model: row.model };
      prev.n += 1;
      map.set(key, prev);
    }
    return [...map.values()].sort((a, b) => b.n - a.n);
  }
  return {
    brands: tally((r) => r.brand).slice(0, 80),
    models: tally((r) => r.model, true).slice(0, 400),
    versions: tally((r) => r.version, true).slice(0, 200),
    fuels: tally((r) => r.fuel),
    transmissions: tally((r) => r.transmission),
    regions: tally((r) => r.region),
    cities: tally((r) => r.city).slice(0, 80),
    sources: tally((r) => r.source),
    categories: tally((r) => r.category),
  };
}
