import { fetchJson, sleep } from "../lib/http.js";
import { parseKm } from "../lib/parse.js";
import { toListing } from "../lib/normalize.js";
import { CHILEAUTOS_REGIONS } from "../lib/geo.js";

const TYPES = [
  { predicate: "TipoVehículo.Autos.", category: "auto" },
  { predicate: "TipoVehículo.Motos.", category: "moto" },
  { predicate: "TipoVehículo.Camiones.", category: "camion" },
  { predicate: "TipoVehículo.Buses.", category: "camion" },
];

function mapItem(item, category) {
  const fb = item.saveItemAction?.tracking?.fb?.attributes || {};
  const details = item.keyDetails || [];
  return toListing({
    source: "chileautos",
    external_id: item.networkId || fb.content_ids,
    url: item.webDetailsUrl ? `https://www.chileautos.cl${item.webDetailsUrl}` : null,
    title: item.displayTitle || fb.content_name,
    brand: fb.make,
    model: fb.model,
    version: fb.badge,
    year: fb.year,
    mileage: details.find((d) => /km/i.test(d)) || parseKm(details),
    price: item.displayPrice?.price || fb.price,
    currency: item.displayPrice?.preInfo || "CLP",
    category: category === "auto" ? details[0] || "auto" : category,
    body_type: details[0],
    fuel: fb.fuel_type || details.find((d) => /bencina|diesel|diésel|híbrido|electrico|eléctrico|gas/i.test(d)),
    transmission: fb.transmission || details.find((d) => /manual|autom/i.test(d)),
    drivetrain: /4x4|4wd|awd/i.test(item.displayTitle || "") ? "4x4" : null,
    region: item.displayLocation || fb.state,
    seller_type: item.siloTypeFriendlyName || fb.vehCategory,
    image_url: item.heroSection?.items?.[0]?.url,
    condition: fb.condition_of_vehicle,
  });
}

async function fetchPage(predicate, page) {
  const url =
    `https://www.chileautos.cl/mobiapi/chileautos/v1/stock/listing?p=${encodeURIComponent(predicate)}&pg=${page}&ni=18`;
  const json = await fetchJson(url, { ua: "mobile" });
  const items = (json.result || [])
    .filter((row) => row.sectionType === "stockListingItemV1")
    .map((row) => mapItem(row, TYPES.find((t) => t.predicate === predicate)?.category || "auto"))
    .filter((row) => row.external_id && row.price);
  return {
    items,
    totalPages: json.searchContext?.totalPages || 0,
    totalRecords: json.searchContext?.totalRecords || 0,
    pageNum: json.searchContext?.pageNum ?? page,
  };
}

async function scrapePredicate(predicate, label, maxPages, onProgress, bucket) {
  let totalPages = maxPages;
  for (let page = 0; page < totalPages; page++) {
    try {
      const data = await fetchPage(predicate, page);
      if (page === 0) {
        totalPages = Math.min(maxPages, data.totalPages || maxPages);
        onProgress?.({
          source: "chileautos",
          message: `${label}: ${data.totalRecords} avisos, ${totalPages} páginas`,
        });
      }
      bucket.push(...data.items);
      onProgress?.({ source: "chileautos", pages: page + 1, listings: bucket.length });
      if (!data.items.length) break;
      await sleep(110);
    } catch (err) {
      onProgress?.({ source: "chileautos", error: err.message });
      await sleep(700);
      if (page > 2) break;
    }
  }
}

export async function scrapeChileautos({ maxPages = 40, onProgress } = {}) {
  const all = [];
  for (const type of TYPES) {
    await scrapePredicate(type.predicate, type.category, maxPages, onProgress, all);
  }
  const perRegion = Math.max(2, Math.min(8, Math.floor(maxPages / 6)));
  for (const region of CHILEAUTOS_REGIONS) {
    const predicate = `(And.TipoVehículo.Autos._.Región.${region}.)`;
    await scrapePredicate(predicate, region, perRegion, onProgress, all);
  }
  return all;
}

export const chileautosMeta = {
  id: "chileautos",
  name: "Chileautos",
  url: "https://www.chileautos.cl",
};
