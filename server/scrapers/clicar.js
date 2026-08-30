import * as cheerio from "cheerio";
import { fetchText, sleep } from "../lib/http.js";
import { parseKm, parseYear, pickListedPrice, titleCase } from "../lib/parse.js";
import { toListing } from "../lib/normalize.js";

function parseCard($, el) {
  const node = $(el);
  const href = node.attr("href") || "";
  if (!/\/(marcas|seminuevos)[^"]*-\d+/.test(href)) return null;
  const id = href.match(/-(\d+)(?:\/)?$/)?.[1];
  if (!id) return null;
  const url = href.startsWith("http") ? href : `https://www.clicar.cl${href}`;
  const text = node.text().replace(/\s+/g, " ").trim();
  const price = pickListedPrice(text, 1_500_000);
  if (!price) return null;
  const parts = href.split("/").filter(Boolean);
  const slug = parts.at(-1) || "";
  const brand = parts.includes("marcas") ? parts[parts.indexOf("marcas") + 1] : parts[1];
  const model = slug.replace(/-\d+$/, "").replace(new RegExp(`^${brand}-`, "i"), "");
  const img = node.find("img").attr("src") || node.find("img").attr("data-src");
  const year = parseYear(text.match(/(\d{4})\s*\|/)?.[1]) || parseYear(text);
  const modelName = model.replace(/-/g, " ");
  return toListing({
    source: "clicar",
    external_id: id,
    url,
    title: [titleCase(brand), titleCase(modelName), year].filter(Boolean).join(" "),
    brand,
    model: modelName,
    year,
    mileage: parseKm(text),
    price,
    category: /camioneta|pickup/i.test(text) ? "camioneta" : /suv/i.test(text) ? "suv" : "auto",
    fuel: /diesel|diésel/i.test(text) ? "diesel" : /elect/i.test(text) ? "electrico" : "bencina",
    transmission: /automatic|automátic|at\b/i.test(text) ? "automática" : /mecanic|manual|mt\b/i.test(text) ? "manual" : null,
    region: "Metropolitana de Santiago",
    seller_type: "automotora",
    image_url: img,
    condition: "usado",
  });
}

export async function scrapeClicar({ maxPages = 4, onProgress } = {}) {
  const all = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://www.clicar.cl/vehiculos/usado?page=${page}`;
    try {
      const res = await fetchText(url, { ua: "desktop" });
      if (!res.ok) break;
      const $ = cheerio.load(res.text);
      let added = 0;
      $("a[href]").each((_, el) => {
        const row = parseCard($, el);
        if (!row?.price || seen.has(row.external_id)) return;
        seen.add(row.external_id);
        all.push(row);
        added += 1;
      });
      onProgress?.({ source: "clicar", pages: page, listings: all.length, message: `pág. ${page}: +${added}` });
      if (!added) break;
      await sleep(280);
    } catch (err) {
      onProgress?.({ source: "clicar", error: err.message });
      break;
    }
  }
  return all;
}

export const clicarMeta = {
  id: "clicar",
  name: "Clicar",
  url: "https://www.clicar.cl/vehiculos/usado",
};
