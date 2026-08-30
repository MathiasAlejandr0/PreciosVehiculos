import { fetchText, mapPool, sleep } from "../lib/http.js";
import { parseKm, parseYear, pickListedPrice, titleCase } from "../lib/parse.js";
import { toListing } from "../lib/normalize.js";

const SLUG_RE = /\/comprar\/([a-z0-9-]+)~([^~"'\\ ]+)~(\d{4})~([a-z0-9-]+)/gi;

function collectHrefs(html) {
  const seen = new Set();
  const hrefs = [];
  for (const m of String(html || "").matchAll(SLUG_RE)) {
    const href = `/comprar/${m[1]}~${m[2]}~${m[3]}~${m[4]}`;
    if (seen.has(m[4])) continue;
    seen.add(m[4]);
    hrefs.push({
      href,
      brand: m[1],
      model: m[2].replace(/-/g, " "),
      year: parseYear(m[3]),
      id: m[4],
    });
  }
  return hrefs;
}

function meta(html, prop) {
  const re = new RegExp(`property="${prop}"[^>]*content="([^"]*)"`, "i");
  const re2 = new RegExp(`content="([^"]*)"[^>]*property="${prop}"`, "i");
  return html.match(re)?.[1] || html.match(re2)?.[1] || "";
}

async function fromDetail(item) {
  const url = `https://www.checkeados.cl${item.href}`;
  const res = await fetchText(url, { ua: "desktop" });
  if (!res.ok) return null;
  const html = res.text;
  const price = pickListedPrice(meta(html, "og:description"), 3_000_000);
  if (!price) return null;
  const title = meta(html, "og:title") || `${item.brand} ${item.model} ${item.year || ""}`;
  const city = html.match(/Disponible en ([A-Za-záéíóúñÁÉÍÓÚÑ ]{3,40})/i)?.[1]?.trim();
  return toListing({
    source: "checkeados",
    external_id: item.id,
    url,
    title: titleCase(title.replace(/\s*usado en venta.*$/i, "").trim()) || [titleCase(item.brand), titleCase(item.model), item.year].filter(Boolean).join(" "),
    brand: item.brand,
    model: item.model,
    year: item.year || parseYear(title),
    mileage: parseKm(html),
    price,
    category: /suv|4runner|x-trail|t-cross|nivus|kicks|creta|xc40|tiggo|edge/i.test(`${item.brand} ${item.model} ${title}`) ? "suv" : "auto",
    city: city || "Las Condes",
    region: "Metropolitana de Santiago",
    seller_type: "automotora",
    image_url: meta(html, "og:image") || null,
    condition: "usado",
  });
}

export async function scrapeCheckeados({ maxPages = 4, onProgress } = {}) {
  const all = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1 ? "https://www.checkeados.cl/comprar" : `https://www.checkeados.cl/comprar?page=${page}`;
    try {
      const res = await fetchText(url, { ua: "desktop" });
      if (!res.ok) break;
      const hrefs = collectHrefs(res.text).filter((x) => !seen.has(x.id));
      const rows = (await mapPool(hrefs, 5, fromDetail)).filter((row) => row?.price);
      let added = 0;
      for (const row of rows) {
        if (seen.has(row.external_id)) continue;
        seen.add(row.external_id);
        all.push(row);
        added += 1;
      }
      onProgress?.({ source: "checkeados", pages: page, listings: all.length, message: `pág. ${page}: +${added}` });
      if (!hrefs.length) break;
      await sleep(250);
    } catch (err) {
      onProgress?.({ source: "checkeados", error: err.message });
      break;
    }
  }
  return all;
}

export const checkeadosMeta = {
  id: "checkeados",
  name: "Checkeados",
  url: "https://www.checkeados.cl/comprar",
};
