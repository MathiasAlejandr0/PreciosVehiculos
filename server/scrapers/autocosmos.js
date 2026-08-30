import * as cheerio from "cheerio";
import { fetchText, sleep } from "../lib/http.js";
import { parseKm, parseYear } from "../lib/parse.js";
import { toListing } from "../lib/normalize.js";

const BRAND_PATHS = [
  "toyota", "hyundai", "chevrolet", "kia", "nissan", "suzuki", "ford", "mazda",
  "volkswagen", "peugeot", "renault", "mitsubishi", "honda", "bmw", "mercedes-benz",
  "audi", "jeep", "chery", "mg", "jac", "byd", "maxus", "ssangyong", "fiat",
];

function parseCard($, el) {
  const node = $(el);
  const href = node.find("a[href*='/auto/usado/']").attr("href") || node.attr("href");
  if (!href || /[?&](pidx|sort)=/.test(href) || href.split("/").filter(Boolean).length < 4) return null;
  const url = href.startsWith("http") ? href : `https://www.autocosmos.cl${href}`;
  const idMatch = href.match(/\/(\d+)(?:\/)?(?:\?|$)/) || href.match(/usado\/[^/]+\/([^/?]+)/);
  const text = node.text().replace(/\s+/g, " ").trim();
  const amounts = [...text.matchAll(/\$\s*([\d.]+)/g)].map((m) => m[0]);
  const price = /pie\s*:/i.test(text) && amounts.length > 1 ? amounts[amounts.length - 1] : amounts[0];
  const title = node.find("h2, h3, .title, .nombre, a").first().text().trim() || text.slice(0, 90);
  const km = parseKm(text);
  const year = parseYear(text);
  const parts = href.split("/").filter(Boolean);
  const brand = parts.includes("usado") ? parts[parts.indexOf("usado") + 1] : null;
  const model = parts.includes("usado") ? parts[parts.indexOf("usado") + 2] : null;
  const img = node.find("img").attr("src") || node.find("img").attr("data-src");
  const externalId = idMatch?.[1] || url;
  return toListing({
    source: "autocosmos",
    external_id: String(externalId),
    url,
    title: /pie/i.test(text) ? `${title} ${text}` : title,
    brand,
    model: model && !/^\d+$/.test(model) ? model : undefined,
    year,
    mileage: km,
    price,
    category: "auto",
    image_url: img,
    condition: "usado",
  });
}

export async function scrapeAutocosmos({ maxPages = 3, onProgress } = {}) {
  const all = [];
  const seen = new Set();
  for (const brand of BRAND_PATHS) {
    for (let page = 1; page <= maxPages; page++) {
      const url = `https://www.autocosmos.cl/auto/usado/${brand}${page > 1 ? `?pidx=${page}` : ""}`;
      try {
        const res = await fetchText(url, { ua: "desktop" });
        if (!res.ok) break;
        const $ = cheerio.load(res.text);
        const cards = $("a[href*='/auto/usado/'], article, .listing, .card").toArray();
        let added = 0;
        for (const el of cards) {
          const row = parseCard($, el);
          if (!row?.price || seen.has(row.external_id)) continue;
          seen.add(row.external_id);
          all.push(row);
          added += 1;
        }
        onProgress?.({
          source: "autocosmos",
          listings: all.length,
          message: `${brand} pág. ${page}: +${added}`,
        });
        if (!added) break;
        await sleep(220);
      } catch (err) {
        onProgress?.({ source: "autocosmos", error: err.message });
        break;
      }
    }
  }
  return all;
}

export const autocosmosMeta = {
  id: "autocosmos",
  name: "Autocosmos",
  url: "https://www.autocosmos.cl",
};
