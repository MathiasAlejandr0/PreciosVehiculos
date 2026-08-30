export const REGIONS = [
  { id: "arica", name: "Arica y Parinacota", cities: ["Arica", "Putre"] },
  { id: "tarapaca", name: "Tarapacá", cities: ["Iquique", "Alto Hospicio"] },
  { id: "antofagasta", name: "Antofagasta", cities: ["Antofagasta", "Calama", "Tocopilla"] },
  { id: "atacama", name: "Atacama", cities: ["Copiapó", "Vallenar", "Caldera"] },
  { id: "coquimbo", name: "Coquimbo", cities: ["La Serena", "Coquimbo", "Ovalle", "Illapel"] },
  { id: "valparaiso", name: "Valparaíso", cities: ["Valparaíso", "Viña del Mar", "Quilpué", "Villa Alemana", "San Antonio", "Quillota", "Los Andes", "San Felipe", "Concón", "Limache"] },
  { id: "metropolitana", name: "Metropolitana de Santiago", cities: ["Santiago", "Las Condes", "Providencia", "Ñuñoa", "Maipú", "Puente Alto", "La Florida", "Lo Barnechea", "Vitacura", "Macul", "San Miguel", "La Reina", "Peñalolén", "Recoleta", "Independencia", "Estación Central", "Pudahuel", "Quilicura", "Huechuraba", "San Bernardo", "Colina", "La Cisterna", "San Joaquín", "Buin", "Cerrillos", "Conchalí", "El Bosque", "La Pintana", "Lampa", "Melipilla", "Paine", "Pedro Aguirre Cerda", "Peñalolen", "Pirque", "Padre Hurtado", "Quinta Normal", "Renca", "San Ramón", "San José de Maipo", "Talagante", "Ñuñoa"] },
  { id: "ohiggins", name: "O'Higgins", cities: ["Rancagua", "San Fernando", "Rengo", "Santa Cruz"] },
  { id: "maule", name: "Maule", cities: ["Talca", "Curicó", "Linares", "Constitución"] },
  { id: "nuble", name: "Ñuble", cities: ["Chillán", "San Carlos"] },
  { id: "biobio", name: "Biobío", cities: ["Concepción", "Talcahuano", "Los Ángeles", "Coronel", "Chiguayante", "San Pedro de la Paz"] },
  { id: "araucania", name: "Araucanía", cities: ["Temuco", "Villarrica", "Pucón", "Angol"] },
  { id: "rios", name: "Los Ríos", cities: ["Valdivia", "La Unión"] },
  { id: "lagos", name: "Los Lagos", cities: ["Puerto Montt", "Osorno", "Castro", "Puerto Varas", "Ancud"] },
  { id: "aysen", name: "Aysén", cities: ["Coyhaique", "Puerto Aysén"] },
  { id: "magallanes", name: "Magallanes", cities: ["Punta Arenas", "Puerto Natales"] },
];

export const MARKETPLACES = [
  { id: "chileautos", name: "Chileautos", url: "https://www.chileautos.cl", size: "nacional", listings: "~60.000", coverage: "16 regiones", priority: 1 },
  { id: "yapo", name: "Yapo", url: "https://www.yapo.cl/autos-usados", size: "nacional", listings: "~34.000", coverage: "ciudades de todo Chile", priority: 2 },
  { id: "mercadolibre", name: "Mercado Libre", url: "https://autos.mercadolibre.cl/autos-usados", size: "nacional", listings: "alto volumen", coverage: "regiones ML", priority: 3 },
  { id: "facebook", name: "Facebook Marketplace", url: "https://www.facebook.com/marketplace/santiago/vehicles", size: "nacional", listings: "alto volumen particular", coverage: "ciudades de Chile", priority: 4 },
  { id: "autocosmos", name: "Autocosmos", url: "https://www.autocosmos.cl/usados", size: "nacional", listings: "medio", coverage: "clasificados por marca", priority: 5 },
  { id: "clicar", name: "Clicar", url: "https://www.clicar.cl/vehiculos/usado", size: "red de automotoras", listings: "seminuevos inspeccionados", coverage: "principalmente RM y grandes ciudades", priority: 6 },
  { id: "kavak", name: "Kavak", url: "https://www.kavak.com/cl/usados", size: "compra directa", listings: "usados inspeccionados con garantía", coverage: "Santiago", priority: 7 },
  { id: "checkeados", name: "Checkeados", url: "https://www.checkeados.cl/comprar", size: "certificados", listings: "revisión mecánica y garantía", coverage: "Santiago", priority: 8 },
  { id: "autocl", name: "auto.cl", url: "https://www.auto.cl/usados", size: "agregador + crédito", listings: "cotizar, comparar y financiar", coverage: "nacional", priority: 9 },
  { id: "autosusados", name: "Autosusados.cl", url: "https://autosusados.cl", size: "agregador", listings: "variable", coverage: "nacional", priority: 10 },
];

export const CHILEAUTOS_REGIONS = [
  "Metropolitana de Santiago",
  "Valparaíso",
  "Biobío",
  "Araucanía",
  "Los Lagos",
  "Maule",
  "O'Higgins",
  "Coquimbo",
  "Antofagasta",
  "Ñuble",
  "Los Ríos",
  "Tarapacá",
  "Atacama",
  "Magallanes",
  "Arica y Parinacota",
  "Aysén",
];

export const YAPO_CITY_PATHS = [
  "santiago", "las-condes", "maipu", "puente-alto",
  "valparaiso", "vina-del-mar",
  "concepcion", "talcahuano",
  "la-serena", "coquimbo",
  "antofagasta", "calama", "iquique", "arica",
  "temuco", "valdivia", "osorno", "puerto-montt",
  "rancagua", "talca", "curico", "chillan",
  "copiapo", "punta-arenas",
];

export const ML_REGION_PATHS = [
  "santiago-metropolitana",
  "valparaiso",
  "biobio",
  "araucania",
  "los-lagos",
  "maule",
  "ohiggins",
  "coquimbo",
  "antofagasta",
  "tarapaca",
];

const CITY_TO_REGION = new Map();
for (const region of REGIONS) {
  for (const city of region.cities) {
    CITY_TO_REGION.set(norm(city), region.name);
  }
}

const REGION_ALIASES = {
  "region metropolitana": "Metropolitana de Santiago",
  "metropolitana": "Metropolitana de Santiago",
  "metropolitana de santiago": "Metropolitana de Santiago",
  "rm": "Metropolitana de Santiago",
  "santiago metropolitana": "Metropolitana de Santiago",
  "santiago-metropolitana": "Metropolitana de Santiago",
  "bio bio": "Biobío",
  "biobio": "Biobío",
  "bio-bio": "Biobío",
  "bío bío": "Biobío",
  "ohiggins": "O'Higgins",
  "o higgins": "O'Higgins",
  "libertador": "O'Higgins",
  "araucania": "Araucanía",
  "la araucania": "Araucanía",
  "los rios": "Los Ríos",
  "los lagos": "Los Lagos",
  "nuble": "Ñuble",
  "magallanes y antartica chilena": "Magallanes",
  "aysen": "Aysén",
  "aisen": "Aysén",
  "valparaiso": "Valparaíso",
  "coquimbo": "Coquimbo",
  "antofagasta": "Antofagasta",
  "atacama": "Atacama",
  "tarapaca": "Tarapacá",
  "maule": "Maule",
  "arica y parinacota": "Arica y Parinacota",
};

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveRegion(key) {
  const dashed = key.replace(/-/g, " ");
  if (REGION_ALIASES[key]) return REGION_ALIASES[key];
  if (dashed !== key && REGION_ALIASES[dashed]) return REGION_ALIASES[dashed];
  const exact = REGIONS.find((r) => norm(r.name) === key || norm(r.name) === dashed);
  if (exact) return exact.name;
  if (key.length >= 6) {
    const hit = REGIONS.find((r) => key.includes(norm(r.name)) || norm(r.name).includes(key) || dashed.includes(norm(r.name)));
    if (hit) return hit.name;
  }
  return null;
}

export function parseLocation(raw) {
  const text = String(raw || "").trim();
  if (!text || /^(chile|n\/?d|sin dato|sin region)$/i.test(text)) return { region: null, city: null };

  const parts = text.split(/[|,/–]+/).map((p) => p.trim()).filter(Boolean);
  const blobs = parts.length > 1 ? parts : [text];

  let region = null;
  let city = null;
  for (const blob of blobs) {
    const key = norm(blob);
    if (!key) continue;
    if (CITY_TO_REGION.has(key)) {
      city = titleFromKey(key, blob);
      region = CITY_TO_REGION.get(key);
      continue;
    }
    const asRegion = resolveRegion(key);
    if (asRegion) {
      region = asRegion;
    }
  }

  if (!city) {
    const key = norm(text);
    const cityHit = [...CITY_TO_REGION.keys()]
      .filter((c) => c.length >= 4 && (key === c || key.includes(c)))
      .sort((a, b) => b.length - a.length)[0];
    if (cityHit) {
      city = titleFromKey(cityHit, text);
      region = region || CITY_TO_REGION.get(cityHit);
    }
  }

  if (city && !region) region = CITY_TO_REGION.get(norm(city)) || null;
  if (region && city && foldEq(region, city)) city = null;
  return { region, city };
}

function foldEq(a, b) {
  return norm(a) === norm(b);
}

function titleFromKey(key, fallback) {
  for (const region of REGIONS) {
    const hit = region.cities.find((c) => norm(c) === key);
    if (hit) return hit;
  }
  return fallback;
}
