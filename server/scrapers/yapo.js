import * as cheerio from "cheerio";
import { fetchText, sleep } from "../lib/http.js";
import { parseKm, parseYear } from "../lib/parse.js";
import { toListing } from "../lib/normalize.js";
import { YAPO_CITY_PATHS } from "../lib/geo.js";

const PATHS = [
  { path: "autos-usados", category: "auto" },
  { path: "motos", category: "moto" },
  { path: "camiones", category: "camion" },
];

function absUrl(href) {
  if (!href) return null;
  if (href.startsWith("http")) return href;
  return `https://www.yapo.cl${href}`;
}

function parseTile($, el, category) {
  const node = $(el);
  const link = node.find("a.d3-ad-tile__description, a[href*='/autos-'], a[href*='/motos'], a[href*='/camion']").first();
  const href = link.attr("href") || node.find("a[href]").first().attr("href");
  const id =
    node.attr("data-adid") ||
    node.attr("data-id") ||
    node.find("[data-adid]").attr("data-adid") ||
    (href || "").match(/\/(\d+)(?:\?|$)/)?.[1];
  if (!id) return null;
  const title = node.find(".d3-ad-tile__title").text();
  const desc = node.find(".d3-ad-tile__short-description").text();
  const details = node
    .find(".d3-ad-tile__details-item")
    .map((_, li) => $(li).text().replace(/\s+/g, " ").trim())
    .get();
  const loc = node.find(".d3-ad-tile__location").text();
  const seller = node.find(".d3-ad-tile__seller span").first().text();
  const img = node.find("img").attr("src") || node.find("img").attr("data-src");
  const brandModel = title.trim().split(/\s+/);
  return toListing({
    source: "yapo",
    external_id: id,
    url: absUrl(href),
    title: `${title} ${desc}`.trim(),
    brand: brandModel[0],
    model: brandModel.slice(1).join(" "),
    year: details.find((d) => parseYear(d)) || parseYear(desc),
    mileage: details.find((d) => /km/i.test(d)) || parseKm(details.join(" ")),
    price: node.find(".d3-ad-tile__price").first().text(),
    category,
    fuel: details.find((d) => /bencina|diesel|diésel|híbrido|eléctrico/i.test(d)),
    transmission: details.find((d) => /manual|autom/i.test(d)),
    region: loc,
    city: loc,
    seller_type: node.find(".d3-ad-tile__seals").length ? "profesional" : "particular",
    seller_name: seller,
    image_url: img,
    condition: "usado",
  });
}

async function fetchYapoPage(path, page) {
  const suffix = page <= 1 ? "" : `.${page}`;
  const url = `https://www.yapo.cl/${path}${suffix}`;
  const res = await fetchText(url, { ua: "desktop" });
  if (!res.ok) throw new Error(`Yapo HTTP ${res.status}`);
  const $ = cheerio.load(res.text);
  const tiles = $(".d3-ad-tile__content, .d3-ad-tile").toArray();
  const seen = new Set();
  const items = [];
  for (const el of tiles) {
    const row = parseTile($, el, PATHS.find((p) => p.path === path)?.category || "auto");
    if (!row || seen.has(row.external_id)) continue;
    seen.add(row.external_id);
    items.push(row);
  }
  const totalMatch = res.text.match(/total_results=(\d+)/);
  return { items, total: totalMatch ? Number(totalMatch[1]) : null };
}

export async function scrapeYapo({ maxPages = 20, onProgress } = {}) {
  const all = [];
  for (const { path, category } of PATHS) {
    for (let page = 1; page <= maxPages; page++) {
      try {
        const data = await fetchYapoPage(path, page);
        all.push(...data.items);
        onProgress?.({
          source: "yapo",
          pages: page,
          listings: all.length,
          message: `${category} pág. ${page}: ${data.items.length} avisos`,
        });
        if (!data.items.length) break;
        await sleep(280);
      } catch (err) {
        onProgress?.({ source: "yapo", error: err.message });
        await sleep(900);
        if (page > 2) break;
      }
    }
  }
  const cityPages = Math.max(1, Math.min(3, Math.floor(maxPages / 4)));
  for (const city of YAPO_CITY_PATHS) {
    try {
      const data = await fetchYapoPage(`autos-usados/${city}`, 1);
      all.push(...data.items.map((row) => ({ ...row, city: row.city || city.replace(/-/g, " ") })));
      onProgress?.({ source: "yapo", listings: all.length, message: `ciudad ${city}: ${data.items.length}` });
      await sleep(220);
    } catch {
      /* URL de ciudad no disponible */
    }
    if (cityPages < 1) break;
  }
  return all;
}

export const yapoMeta = {
  id: "yapo",
  name: "Yapo",
  url: "https://www.yapo.cl",
};
