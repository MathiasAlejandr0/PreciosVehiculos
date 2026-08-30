import * as cheerio from "cheerio";
import { fetchText, sleep } from "../lib/http.js";
import { parseKm, parseYear, pickListedPrice, titleCase } from "../lib/parse.js";
import { toListing } from "../lib/normalize.js";

function parseCard($, el) {
  const node = $(el);
  const href = node.attr("href") || "";
  if (!/\/cl\/venta\//.test(href)) return null;
  const url = href.startsWith("http") ? href : `https://www.kavak.com${href}`;
  const slug = url.split("/").filter(Boolean).pop();
  if (!slug) return null;
  const text = node.text().replace(/\s+/g, " ").trim();
  const price = pickListedPrice(text, 1_500_000);
  if (!price) return null;
  const year = parseYear(slug) || parseYear(text);
  const bits = slug.replace(/-\d{4}$/, "").split("-");
  const brand = bits[0];
  const model = (bits[1] || "").replace(/_/g, " ");
  const img = node.find("img").attr("src") || node.find("img").attr("data-src");
  return toListing({
    source: "kavak",
    external_id: slug,
    url,
    title: [titleCase(brand), titleCase(model), year].filter(Boolean).join(" ") || text.slice(0, 80),
    brand,
    model,
    year,
    mileage: parseKm(text),
    price,
    category: /suv/i.test(slug) ? "suv" : /camioneta|pickup/i.test(slug) ? "camioneta" : "auto",
    transmission: /automático|automatico|cvt|auto\b/i.test(text) ? "automática" : /manual/i.test(text) ? "manual" : null,
    region: "Metropolitana de Santiago",
    seller_type: "kavak",
    image_url: img,
    condition: "usado",
  });
}

export async function scrapeKavak({ maxPages = 4, onProgress } = {}) {
  const all = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1 ? "https://www.kavak.com/cl/usados" : `https://www.kavak.com/cl/usados?page=${page}`;
    try {
      const res = await fetchText(url, { ua: "desktop" });
      if (!res.ok) break;
      const $ = cheerio.load(res.text);
      let added = 0;
      $("a[href*='/cl/venta/']").each((_, el) => {
        const row = parseCard($, el);
        if (!row?.price || seen.has(row.external_id)) return;
        seen.add(row.external_id);
        all.push(row);
        added += 1;
      });
      onProgress?.({ source: "kavak", pages: page, listings: all.length, message: `pág. ${page}: +${added}` });
      if (!added) break;
      await sleep(300);
    } catch (err) {
      onProgress?.({ source: "kavak", error: err.message });
      break;
    }
  }
  return all;
}

export const kavakMeta = {
  id: "kavak",
  name: "Kavak",
  url: "https://www.kavak.com/cl/usados",
};
