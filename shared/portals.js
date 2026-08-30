import { facebookMarketplaceUrl } from "./facebook.js";

export function queryText({ brand = "", model = "", year = "" } = {}) {
  return [brand, model, year].filter(Boolean).join(" ").trim();
}

export function portalSearchLinks(query = {}) {
  const q = queryText(query);
  const enc = encodeURIComponent(q);
  const brand = String(query.brand || "").toLowerCase().replace(/\s+/g, "-");
  return [
    {
      id: "autocl",
      name: "auto.cl",
      hint: "Cotiza, compara y financia",
      url: q ? `https://www.auto.cl/usados?q=${enc}` : "https://www.auto.cl/usados",
    },
    {
      id: "kavak",
      name: "Kavak",
      hint: "Usados inspeccionados con garantía",
      url: q ? `https://www.kavak.com/cl/usados?q=${enc}` : "https://www.kavak.com/cl/usados",
    },
    {
      id: "clicar",
      name: "Clicar",
      hint: "Seminuevos y tasación en línea",
      url: brand ? `https://www.clicar.cl/marcas/${encodeURIComponent(brand)}/usado` : "https://www.clicar.cl/vehiculos/usado",
    },
    {
      id: "checkeados",
      name: "Checkeados",
      hint: "Certificados con revisión mecánica",
      url: q ? `https://www.checkeados.cl/comprar?q=${enc}` : "https://www.checkeados.cl/comprar",
    },
    {
      id: "facebook",
      name: "Facebook",
      hint: "Particulares en Chile",
      url: facebookMarketplaceUrl(query),
    },
  ];
}
