import { parseKm, parsePrice, parseYear, titleCase, cleanText } from "./parse.js";
import { parseLocation } from "./geo.js";

export const BRANDS = [
  "Toyota", "Hyundai", "Chevrolet", "Kia", "Nissan", "Suzuki", "Ford", "Mazda",
  "Volkswagen", "Peugeot", "Renault", "Mitsubishi", "Honda", "BMW", "Mercedes-Benz",
  "Audi", "Jeep", "Subaru", "Volvo", "Skoda", "Chery", "MG", "JAC", "Great Wall",
  "GAC", "BYD", "Maxus", "SsangYong", "Fiat", "Citroën", "Dodge", "RAM", "Land Rover",
  "Mini", "Porsche", "Lexus", "Opel", "Seat", "Cupra", "DFSK", "Foton", "Isuzu",
  "Iveco", "Yamaha", "Kawasaki", "Harley-Davidson", "Bajaj", "KTM", "Benelli",
  "Changan", "Geely", "Haval", "Jetour", "Omoda", "JMC", "Mahindra", "Daihatsu",
  "Chrysler", "Alfa Romeo", "Ferrari", "Maserati", "Tesla", "Polestar", "Dongfeng",
  "Faw", "Lifan", "ZNA", "International", "Scania", "Volvo Trucks", "Kenworth",
  "Mercedes Benz", "VW", "Citroen", "Ssangyong", "Great wall",
];

const BRAND_ALIAS = {
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
  "mercedes benz": "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  "mercedes-benz": "Mercedes-Benz",
  bmw: "BMW",
  mg: "MG",
  gac: "GAC",
  byd: "BYD",
  ram: "RAM",
  ssangyong: "SsangYong",
  citroen: "Citroën",
  "citroën": "Citroën",
  citron: "Citroën",
  "land rover": "Land Rover",
  "great wall": "Great Wall",
  "harley davidson": "Harley-Davidson",
  kia: "Kia",
  chevrolet: "Chevrolet",
  chevy: "Chevrolet",
};

const SORTED_BRANDS = [...BRANDS].sort((a, b) => b.length - a.length);

const JUNK_BRANDS = new Set([
  "moto", "motos", "motocicleta", "cuatrimoto", "triciclo", "tlriciclo",
  "bicicleta", "silla", "torito", "semi", "de",
]);

export function normalizeBrand(value, title = "") {
  const hay = `${value || ""} ${title || ""}`.toLowerCase().replace(/[-_]/g, " ");
  const raw = cleanText(value)?.toLowerCase();
  if (raw && JUNK_BRANDS.has(raw)) {
    const fromTitle = SORTED_BRANDS.find((brand) => new RegExp(`\\b${brand.replace(/[-]/g, "[- ]")}\\b`, "i").test(title || ""));
    return fromTitle ? normalizeBrandName(fromTitle) : null;
  }
  const aliasHit = BRAND_ALIAS[raw];
  if (aliasHit) return aliasHit;
  for (const brand of SORTED_BRANDS) {
    const re = new RegExp(`\\b${brand.replace(/[-]/g, "[- ]")}\\b`, "i");
    if (re.test(hay)) return normalizeBrandName(brand);
  }
  return titleCase(value);
}

function normalizeBrandName(brand) {
  return BRAND_ALIAS[brand.toLowerCase()] || titleCase(brand);
}

export function normalizeCategory(raw, keyDetails = []) {
  const text = `${raw || ""} ${[].concat(keyDetails).join(" ")}`.toLowerCase();
  if (/(moto|scooter|enduro|naked)/.test(text)) return "moto";
  if (/(camion\b|camión|truck|bus\b)/.test(text)) return "camion";
  if (/(pickup|pick-up|camioneta)/.test(text)) return "camioneta";
  if (/(suv|crossover|jeep|4x4|todo terreno)/.test(text)) return "suv";
  if (/(van|furgon|furgón|minibus)/.test(text)) return "comercial";
  if (/(hatch|sedan|sedán|citycar|coupe|coupé|station|wagon|convertible)/.test(text)) return "auto";
  return raw ? "auto" : "auto";
}

export function normalizeSeller(value) {
  const t = String(value || "").toLowerCase();
  if (/(agencia|automotora|dealer|concesion|profesional|kavak)/.test(t)) return "automotora";
  if (/(particular|persona|usado)/.test(t)) return "particular";
  return t ? "otro" : null;
}

export function fingerprint(row) {
  const brand = (row.brand || "").toLowerCase();
  const model = (row.model || "").toLowerCase().replace(/\s+/g, " ");
  const year = row.year || 0;
  const kmBucket = row.mileage != null ? Math.round(row.mileage / 2500) * 2500 : "x";
  const priceBucket = row.price != null ? Math.round(row.price / 250000) * 250000 : "x";
  return `${brand}|${model}|${year}|${kmBucket}|${priceBucket}`;
}

export function toListing(partial) {
  const title = cleanText(partial.title);
  const brand = normalizeBrand(partial.brand, title);
  const model = titleCase(partial.model) || inferModel(title, brand);
  const row = {
    source: partial.source,
    external_id: String(partial.external_id),
    url: partial.url || null,
    title,
    brand,
    model,
    version: cleanText(partial.version),
    year: parseYear(partial.year) || parseYear(title),
    mileage: parseKm(partial.mileage),
    price: parsePrice(partial.price),
    currency: partial.currency || "CLP",
    category: normalizeCategory(partial.category, partial.body_type),
    body_type: cleanText(partial.body_type),
    fuel: cleanText(partial.fuel)?.toLowerCase(),
    transmission: cleanText(partial.transmission)?.toLowerCase(),
    drivetrain: cleanText(partial.drivetrain)?.toLowerCase(),
    region: parseLocation(partial.region || partial.city).region || cleanText(partial.region),
    city: parseLocation(partial.city || partial.region).city || cleanText(partial.city),
    seller_type: normalizeSeller(partial.seller_type),
    seller_name: cleanText(partial.seller_name),
    image_url: partial.image_url && !String(partial.image_url).startsWith("data:") ? partial.image_url : null,
    condition: /new|nuevo/i.test(partial.condition || "") ? "nuevo" : "usado",
  };
  row.fingerprint = fingerprint(row);
  return row;
}

function inferModel(title, brand) {
  if (!title || !brand) return null;
  const idx = title.toLowerCase().indexOf(brand.toLowerCase());
  if (idx < 0) return null;
  const rest = title.slice(idx + brand.length).replace(/^[\s\-]+/, "");
  const token = rest.split(/[\s\/]+/).filter(Boolean)[0];
  if (!token || /^\d{4}$/.test(token)) return null;
  return titleCase(token.replace(/[^a-z0-9áéíóúüñ-]/gi, ""));
}

export function dealLabel(deltaPct) {
  if (deltaPct == null) return { key: "sin_data", label: "Sin comparables", tone: "zinc" };
  if (deltaPct <= -12) return { key: "oportunidad", label: "Oportunidad", tone: "emerald" };
  if (deltaPct <= -4) return { key: "buen_precio", label: "Buen precio", tone: "lime" };
  if (deltaPct <= 8) return { key: "mercado", label: "Precio de mercado", tone: "sky" };
  return { key: "sobreprecio", label: "Sobreprecio", tone: "rose" };
}
