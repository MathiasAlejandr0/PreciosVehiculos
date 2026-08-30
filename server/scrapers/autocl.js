import { fetchText, sleep } from "../lib/http.js";
import { parseKm, parseYear, pickListedPrice } from "../lib/parse.js";
import { toListing } from "../lib/normalize.js";

function decodeId(suffix) {
  try {
    const pad = suffix.length % 4 === 0 ? suffix : suffix + "=".repeat(4 - (suffix.length % 4));
    return Buffer.from(pad, "base64").toString("utf8");
  } catch {
    return suffix;
  }
}

function extractListings(html) {
  const items = new Map();
  const re = /href="(\/usados\/([^"]+))"/gi;
  let match;
  while ((match = re.exec(html))) {
    const path = match[1];
    const slug = match[2];
    const idPart = slug.split("-").pop();
    if (!idPart || idPart.length < 6) continue;
    const start = Math.max(0, match.index - 80);
    const chunk = html.slice(start, match.index + 1200);
    const text = chunk.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const price = pickListedPrice(text, 1_500_000);
    if (!price) continue;
    const decoded = decodeId(idPart);
    items.set(idPart, toListing({
      source: "autocl",
      external_id: decoded || idPart,
      url: `https://www.auto.cl${path}`,
      title: text.slice(0, 140),
      brand: slug.split("-")[0],
      model: slug.split("-")[1],
      year: parseYear(slug) || parseYear(text),
      mileage: parseKm(text),
      price,
      category: "auto",
      seller_type: /particular/i.test(text) ? "particular" : "automotora",
      condition: "usado",
    }));
  }
  return [...items.values()].filter((x) => x.price);
}

export async function scrapeAutoCl({ maxPages = 3, onProgress } = {}) {
  const all = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1 ? "https://www.auto.cl/usados" : `https://www.auto.cl/usados?page=${page}`;
    try {
      const res = await fetchText(url, { ua: "desktop" });
      if (!res.ok) {
        onProgress?.({ source: "autocl", error: `HTTP ${res.status} (Cloudflare)` });
        break;
      }
      const items = extractListings(res.text);
      let added = 0;
      for (const row of items) {
        if (seen.has(row.external_id)) continue;
        seen.add(row.external_id);
        all.push(row);
        added += 1;
      }
      onProgress?.({ source: "autocl", pages: page, listings: all.length, message: `pág. ${page}: +${added}` });
      if (!added) break;
      await sleep(320);
    } catch (err) {
      onProgress?.({ source: "autocl", error: err.message });
      break;
    }
  }
  return all;
}

export const autoClMeta = {
  id: "autocl",
  name: "auto.cl",
  url: "https://www.auto.cl/usados",
};
