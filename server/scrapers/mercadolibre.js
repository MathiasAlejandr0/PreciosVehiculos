import { fetchText, sleep } from "../lib/http.js";
import { parseYear } from "../lib/parse.js";
import { toListing } from "../lib/normalize.js";
import { ML_REGION_PATHS } from "../lib/geo.js";

const SEARCHES = [
  { url: "https://autos.mercadolibre.cl/autos-usados", category: "auto" },
  { url: "https://motos.mercadolibre.cl/motos", category: "moto" },
  ...ML_REGION_PATHS.map((slug) => ({
    url: `https://autos.mercadolibre.cl/${slug}/autos-usados`,
    category: "auto",
    region: slug,
  })),
];

function unescape(str) {
  return String(str || "")
    .replace(/\\u002F/g, "/")
    .replace(/\\u002D/g, "-")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"');
}

function parseSlug(url) {
  const path = unescape(url);
  const m = path.match(/MLC-(\d+)-([a-z0-9-]+?)(?:-_JM|$)/i);
  if (!m) return { id: null, tokens: [] };
  const tokens = m[2].split("-").filter(Boolean);
  return { id: `MLC${m[1]}`, tokens };
}

function extractListings(html, category, regionHint) {
  const items = new Map();
  const re = /"id":"(MLC\d+)"([\s\S]{0,2200}?)(?="id":"MLC\d+"|"vertical_id")/g;
  let match;
  while ((match = re.exec(html))) {
    const id = match[1];
    const chunk = match[2];
    const urlMatch = chunk.match(/"url":"([^"]+)"/);
    const priceMatch = chunk.match(/"price":(\d{5,9})/);
    const kmMatch = chunk.match(/"kilometers"\s*:\s*\{[^}]*"number"\s*:\s*(\d+)/i) || chunk.match(/([\d.]+)\s*km/i);
    const yearMatch = chunk.match(/"year"\s*:\s*"?(\d{4})"?/);
    const url = urlMatch ? unescape(urlMatch[1]) : null;
    const slug = parseSlug(url || "");
    const tokens = slug.tokens;
    const year = parseYear(yearMatch?.[1]) || parseYear(tokens.at(-1)) || parseYear(url);
    const brand = tokens[0];
    const model = tokens[1];
    const version = tokens.slice(2, -1).join(" ");
    if (!priceMatch) continue;
    const fullUrl = url ? (url.startsWith("http") ? url : `https://${url}`) : `https://auto.mercadolibre.cl/${id}`;
    items.set(id, toListing({
      source: "mercadolibre",
      external_id: id,
      url: fullUrl,
      title: tokens.length ? tokens.join(" ") : id,
      brand,
      model,
      version,
      year,
      mileage: kmMatch?.[1],
      price: Number(priceMatch[1]),
      category,
      region: regionHint,
      condition: "usado",
    }));
  }

  if (items.size < 8) {
    const urlRe = /https?:\\?\/\\?\/(?:auto|auto\.|www\.)?mercadolibre\.cl\\?\/MLC-(\d+)-([a-z0-9-]+)_JM/gi;
    let um;
    while ((um = urlRe.exec(html))) {
      const id = `MLC${um[1]}`;
      if (items.has(id)) continue;
      const tokens = um[2].split("-");
      items.set(id, toListing({
        source: "mercadolibre",
        external_id: id,
        url: `https://auto.mercadolibre.cl/MLC-${um[1]}-${um[2]}_JM`,
        title: tokens.join(" "),
        brand: tokens[0],
        model: tokens[1],
        year: parseYear(um[2]),
        price: null,
        category,
      }));
    }
  }
  return [...items.values()].filter((x) => x.price);
}

function pageUrl(base, page) {
  if (page <= 1) return base;
  const from = 1 + (page - 1) * 48;
  if (base.includes("?")) return `${base}&desde=${from}`;
  return `${base}_Desde_${from}`;
}

export async function scrapeMercadoLibre({ maxPages = 15, onProgress } = {}) {
  const all = [];
  for (const search of SEARCHES) {
    const pagesFor = search.region ? Math.min(3, maxPages) : maxPages;
    for (let page = 1; page <= pagesFor; page++) {
      try {
        const res = await fetchText(pageUrl(search.url, page), { ua: "desktop" });
        if (!res.ok) throw new Error(`ML HTTP ${res.status}`);
        const items = extractListings(res.text, search.category, search.region);
        all.push(...items);
        onProgress?.({
          source: "mercadolibre",
          pages: page,
          listings: all.length,
          message: `${search.category} pág. ${page}: ${items.length} avisos`,
        });
        if (!items.length) break;
        await sleep(260);
      } catch (err) {
        onProgress?.({ source: "mercadolibre", error: err.message });
        await sleep(900);
        if (page > 2) break;
      }
    }
  }
  return all;
}

export const mercadolibreMeta = {
  id: "mercadolibre",
  name: "Mercado Libre",
  url: "https://autos.mercadolibre.cl",
};
