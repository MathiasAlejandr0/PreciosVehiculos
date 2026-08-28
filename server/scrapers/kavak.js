import * as cheerio from "cheerio";
import { fetchText, sleep } from "../lib/http.js";
import { parseKm, parseYear } from "../lib/parse.js";
import { toListing } from "../lib/normalize.js";

const API_CANDIDATES = [
  "https://www.kavak.com/cl/api/inventory?limit=40&page=1",
  "https://www.kavak.com/api/v1/car?country=cl&limit=40",
];

function fromApiCar(car, idx) {
  const id = car.id || car.sku || car.carId || car.inventoryId || idx;
  return toListing({
    source: "kavak",
    external_id: String(id),
    url: car.url || car.permalink || (car.slug ? `https://www.kavak.com/cl/usados/${car.slug}` : "https://www.kavak.com/cl/usados"),
    title: car.name || car.title || `${car.make || car.brand} ${car.model}`,
    brand: car.make || car.brand,
    model: car.model,
    version: car.version || car.trim,
    year: car.year,
    mileage: car.km || car.mileage || car.odometer,
    price: car.price || car.salePrice || car.amount,
    category: car.bodyType || "auto",
    fuel: car.fuel,
    transmission: car.transmission,
    region: car.city || car.region || "Metropolitana de Santiago",
    seller_type: "kavak",
    image_url: car.image || car.imageUrl || car.photos?.[0],
    condition: "usado",
  });
}

function fromHtml(html) {
  const $ = cheerio.load(html);
  const items = [];
  $("a[href*='/cl/usados/'], a[href*='/usados/']").each((_, el) => {
    const node = $(el);
    const href = node.attr("href");
    if (!href || href.endsWith("/usados") || href.endsWith("/usados/")) return;
    const text = node.text().replace(/\s+/g, " ").trim();
    const price = text.match(/\$\s*[\d.]+/);
    if (!price) return;
    const url = href.startsWith("http") ? href : `https://www.kavak.com${href}`;
    const slug = href.split("/").filter(Boolean).pop();
    const title = node.find("h2, h3, p").first().text().trim() || text.slice(0, 80);
    items.push(toListing({
      source: "kavak",
      external_id: slug,
      url,
      title,
      brand: title.split(" ")[0],
      model: title.split(" ")[1],
      year: parseYear(text),
      mileage: parseKm(text),
      price: price[0],
      seller_type: "kavak",
      condition: "usado",
    }));
  });
  return items.filter((x) => x.price);
}

export async function scrapeKavak({ maxPages = 4, onProgress } = {}) {
  for (const api of API_CANDIDATES) {
    try {
      const res = await fetchText(api, { ua: "desktop", accept: "application/json" });
      if (!res.ok || !res.contentType.includes("json")) continue;
      const json = JSON.parse(res.text);
      const cars = json.items || json.cars || json.results || json.data || [];
      if (Array.isArray(cars) && cars.length) {
        const items = cars.map(fromApiCar).filter((x) => x.price);
        onProgress?.({ source: "kavak", listings: items.length, message: "API Kavak" });
        return items;
      }
    } catch {
      /* try next */
    }
  }

  const all = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1 ? "https://www.kavak.com/cl/usados" : `https://www.kavak.com/cl/usados?page=${page}`;
    try {
      const res = await fetchText(url, { ua: "desktop" });
      const items = fromHtml(res.text);
      for (const row of items) {
        if (seen.has(row.external_id)) continue;
        seen.add(row.external_id);
        all.push(row);
      }
      onProgress?.({ source: "kavak", pages: page, listings: all.length });
      if (!items.length) break;
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
