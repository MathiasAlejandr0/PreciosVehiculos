import { fetchText, sleep } from "../lib/http.js";
import { parseKm, parseYear } from "../lib/parse.js";
import { toListing } from "../lib/normalize.js";
import { FB_CITIES, facebookMarketplaceUrl, facebookVehiclesUrl } from "../../shared/facebook.js";

const QUERIES = [
  "toyota yaris",
  "toyota hilux",
  "hyundai tucson",
  "kia sportage",
  "chevrolet tracker",
  "ford ranger",
  "nissan qashqai",
  "suzuki swift",
  "mazda cx-5",
  "peugeot 3008",
];

function unescapeJson(value) {
  return String(value || "")
    .replace(/\\u002F/g, "/")
    .replace(/\\u003A/g, ":")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003C/g, "<")
    .replace(/\\u003E/g, ">")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function decode(value) {
  return unescapeJson(value)
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pushListing(items, partial, city) {
  const id = String(partial.external_id || "").replace(/\D/g, "");
  if (!id || items.has(id)) return;
  const title = decode(partial.title || "");
  const row = toListing({
    source: "facebook",
    external_id: id,
    url: `https://www.facebook.com/marketplace/item/${id}`,
    title: title || `${partial.brand || ""} ${partial.model || ""}`.trim() || `Aviso ${id}`,
    brand: partial.brand,
    model: partial.model,
    year: partial.year || parseYear(title),
    mileage: partial.mileage || parseKm(title),
    price: partial.price,
    category: "auto",
    region: city?.region,
    city: city?.name,
    image_url: partial.image_url,
    seller_type: "particular",
    condition: "usado",
  });
  if (row?.price) items.set(id, row);
}

function extractListings(html, city) {
  const items = new Map();
  const hay = html.replace(/\\u002F/g, "/");

  const titleRe = /"marketplace_listing_title":"((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = titleRe.exec(hay))) {
    const start = Math.max(0, match.index - 800);
    const chunk = hay.slice(start, match.index + 2800);
    const title = decode(match[1]);
    const id =
      chunk.match(/marketplace\/item\/(\d{6,})/)?.[1] ||
      chunk.match(/"id":"(\d{10,})"/)?.[1];
    const amount =
      chunk.match(/"amount":"(\d{5,9})"/)?.[1] ||
      chunk.match(/"listing_price":\{[^}]*"amount":"?(\d{5,9})"?/)?.[1];
    const loc = decode(chunk.match(/"location_text":\{"text":"((?:\\.|[^"\\])*)"/)?.[1] || "");
    const img = unescapeJson(chunk.match(/"uri":"(https:[^"]+)"/)?.[1] || "");
    if (!id || !amount) continue;
    pushListing(
      items,
      {
        external_id: id,
        title,
        price: Number(amount),
        year: parseYear(title),
        mileage: parseKm(title),
        image_url: img.startsWith("http") ? img : null,
        city: loc,
      },
      loc ? { name: loc, region: city?.region } : city
    );
  }

  const itemRe = /marketplace\/item\/(\d{6,})/g;
  let im;
  while ((im = itemRe.exec(hay))) {
    if (items.has(im[1])) continue;
    const chunk = hay.slice(Math.max(0, im.index - 400), im.index + 1600);
    const amount =
      chunk.match(/"amount":"(\d{5,9})"/)?.[1] ||
      chunk.match(/CLP\\?\$?\s*([\d.]{5,})/)?.[1]?.replace(/\./g, "");
    const title = decode(
      chunk.match(/"marketplace_listing_title":"((?:\\.|[^"\\])*)"/)?.[1] ||
        chunk.match(/"primary_subtitle":"((?:\\.|[^"\\])*)"/)?.[1] ||
        ""
    );
    if (!amount) continue;
    pushListing(
      items,
      { external_id: im[1], title, price: Number(amount), year: parseYear(title), mileage: parseKm(title) },
      city
    );
  }

  return [...items.values()];
}

function targets(maxPages) {
  const cities = FB_CITIES.slice(0, Math.min(FB_CITIES.length, Math.max(4, maxPages + 2)));
  const queries = QUERIES.slice(0, Math.min(QUERIES.length, Math.max(3, maxPages)));
  const urls = [];
  for (const city of cities) {
    urls.push({ url: facebookVehiclesUrl(city.slug), city, label: `${city.name} vehículos` });
  }
  for (const city of cities.slice(0, 4)) {
    for (const q of queries) {
      urls.push({
        url: facebookMarketplaceUrl({ brand: q, city: city.slug }),
        city,
        label: `${city.name} · ${q}`,
      });
    }
  }
  return urls.slice(0, Math.max(8, maxPages * 6));
}

export async function scrapeFacebook({ maxPages = 2, onProgress } = {}) {
  const all = [];
  const seen = new Set();
  const jobs = targets(maxPages);
  for (const job of jobs) {
    try {
      const res = await fetchText(job.url, {
        ua: "desktop",
        headers: {
          Referer: "https://www.facebook.com/marketplace/",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          "Upgrade-Insecure-Requests": "1",
        },
      });
      if (!res.ok) {
        onProgress?.({ source: "facebook", error: `HTTP ${res.status} ${job.label}` });
        if (res.status === 403 || res.status === 429) break;
        continue;
      }
      const items = extractListings(res.text, job.city);
      let added = 0;
      for (const row of items) {
        if (seen.has(row.external_id)) continue;
        seen.add(row.external_id);
        all.push(row);
        added += 1;
      }
      onProgress?.({
        source: "facebook",
        listings: all.length,
        message: `${job.label}: +${added}`,
      });
      await sleep(420 + Math.floor(Math.random() * 280));
    } catch (err) {
      onProgress?.({ source: "facebook", error: err.message });
      await sleep(800);
    }
  }
  return all;
}

export const facebookMeta = {
  id: "facebook",
  name: "Facebook Marketplace",
  url: "https://www.facebook.com/marketplace/santiago/vehicles",
};
