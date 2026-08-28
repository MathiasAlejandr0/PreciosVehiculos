export const REGIONS = [
  { id: "arica", name: "Arica y Parinacota", cities: ["Arica", "Putre"] },
  { id: "tarapaca", name: "Tarapacá", cities: ["Iquique", "Alto Hospicio"] },
  { id: "antofagasta", name: "Antofagasta", cities: ["Antofagasta", "Calama", "Tocopilla"] },
  { id: "atacama", name: "Atacama", cities: ["Copiapó", "Vallenar", "Caldera"] },
  { id: "coquimbo", name: "Coquimbo", cities: ["La Serena", "Coquimbo", "Ovalle", "Illapel"] },
  { id: "valparaiso", name: "Valparaíso", cities: ["Valparaíso", "Viña del Mar", "Quilpué", "Villa Alemana", "San Antonio", "Quillota", "Los Andes"] },
  { id: "metropolitana", name: "Metropolitana de Santiago", cities: ["Santiago", "Las Condes", "Providencia", "Ñuñoa", "Maipú", "Puente Alto", "La Florida", "Lo Barnechea", "Vitacura", "Macul", "San Miguel", "La Reina", "Peñalolén", "Recoleta", "Independencia", "Estación Central", "Pudahuel", "Quilicura", "Huechuraba", "San Bernardo", "Colina"] },
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
  { id: "autocosmos", name: "Autocosmos", url: "https://www.autocosmos.cl/usados", size: "nacional", listings: "medio", coverage: "clasificados por marca", priority: 4 },
  { id: "clicar", name: "Clicar", url: "https://www.clicar.cl", size: "red de automotoras", listings: "~3.000", coverage: "principalmente RM y grandes ciudades", priority: 5 },
  { id: "kavak", name: "Kavak", url: "https://www.kavak.com/cl/usados", size: "compra directa", listings: "cientos", coverage: "Santiago", priority: 6 },
  { id: "autosusados", name: "Autosusados.cl", url: "https://autosusados.cl", size: "agregador", listings: "variable", coverage: "nacional", priority: 7 },
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

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseLocation(raw) {
  const text = String(raw || "").trim();
  if (!text) return { region: null, city: null };
  const key = norm(text);

  const regionHit = REGIONS.find((r) => key.includes(norm(r.name)) || norm(r.name).includes(key));
  const cityHit = [...CITY_TO_REGION.keys()].find((c) => key === c || key.includes(c) || c.includes(key));

  if (cityHit) {
    return { region: CITY_TO_REGION.get(cityHit), city: titleFromKey(cityHit, text) };
  }
  if (regionHit) {
    const maybeCity = regionHit.cities.find((c) => key.includes(norm(c)));
    return { region: regionHit.name, city: maybeCity || null };
  }
  return { region: text, city: text };
}

function titleFromKey(key, fallback) {
  for (const region of REGIONS) {
    const hit = region.cities.find((c) => norm(c) === key);
    if (hit) return hit;
  }
  return fallback;
}
