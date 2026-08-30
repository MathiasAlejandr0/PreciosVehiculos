/** Enlaces y ciudades de Facebook Marketplace Chile. */

export const FB_CITIES = [
  { slug: "santiago", name: "Santiago", region: "Metropolitana de Santiago" },
  { slug: "vina-del-mar", name: "Viña del Mar", region: "Valparaíso" },
  { slug: "valparaiso", name: "Valparaíso", region: "Valparaíso" },
  { slug: "concepcion", name: "Concepción", region: "Biobío" },
  { slug: "temuco", name: "Temuco", region: "Araucanía" },
  { slug: "antofagasta", name: "Antofagasta", region: "Antofagasta" },
  { slug: "la-serena", name: "La Serena", region: "Coquimbo" },
  { slug: "puerto-montt", name: "Puerto Montt", region: "Los Lagos" },
  { slug: "rancagua", name: "Rancagua", region: "O'Higgins" },
  { slug: "talca", name: "Talca", region: "Maule" },
  { slug: "chillan", name: "Chillán", region: "Ñuble" },
  { slug: "iquique", name: "Iquique", region: "Tarapacá" },
  { slug: "valdivia", name: "Valdivia", region: "Los Ríos" },
  { slug: "osorno", name: "Osorno", region: "Los Lagos" },
  { slug: "arica", name: "Arica", region: "Arica y Parinacota" },
];

export function facebookMarketplaceUrl({ brand = "", model = "", year = "", city = "santiago" } = {}) {
  const q = [brand, model, year].filter(Boolean).join(" ").trim() || "auto usado";
  const slug = city || "santiago";
  const params = new URLSearchParams({ query: q, exact: "false" });
  return `https://www.facebook.com/marketplace/${encodeURIComponent(slug)}/search?${params}`;
}

export function facebookVehiclesUrl(city = "santiago") {
  return `https://www.facebook.com/marketplace/${encodeURIComponent(city)}/vehicles?sortBy=creation_time_descend&exact=false`;
}
