import { db, upsertListings, countListings, deactivateStaleListings, closeOrphanCrawls } from "./db.js";
import { clearCompsCache } from "./analytics.js";
import { writeSnapshot } from "./snapshot.js";
import { scrapeChileautos } from "./scrapers/chileautos.js";
import { scrapeYapo } from "./scrapers/yapo.js";
import { scrapeMercadoLibre } from "./scrapers/mercadolibre.js";
import { scrapeAutocosmos } from "./scrapers/autocosmos.js";
import { scrapeKavak } from "./scrapers/kavak.js";
import { scrapeFacebook } from "./scrapers/facebook.js";
import { scrapeClicar } from "./scrapers/clicar.js";
import { scrapeCheckeados } from "./scrapers/checkeados.js";
import { scrapeAutoCl } from "./scrapers/autocl.js";

const MODES = {
  quick: { chileautos: 12, yapo: 6, mercadolibre: 4, facebook: 2, autocosmos: 1, kavak: 2, clicar: 2, checkeados: 2, autocl: 1 },
  standard: { chileautos: 55, yapo: 18, mercadolibre: 12, facebook: 4, autocosmos: 2, kavak: 4, clicar: 6, checkeados: 6, autocl: 2 },
  full: { chileautos: 220, yapo: 60, mercadolibre: 40, facebook: 8, autocosmos: 4, kavak: 8, clicar: 20, checkeados: 20, autocl: 4 },
};

export const crawlState = {
  running: false,
  mode: null,
  startedAt: null,
  finishedAt: null,
  message: "En espera",
  sources: {},
  lastError: null,
  inserted: 0,
  updated: 0,
};

function resetSources() {
  crawlState.sources = {
    chileautos: { listings: 0, pages: 0 },
    yapo: { listings: 0, pages: 0 },
    mercadolibre: { listings: 0, pages: 0 },
    facebook: { listings: 0, pages: 0 },
    autocosmos: { listings: 0, pages: 0 },
    kavak: { listings: 0, pages: 0 },
    clicar: { listings: 0, pages: 0 },
    checkeados: { listings: 0, pages: 0 },
    autocl: { listings: 0, pages: 0 },
  };
}

function onProgress(evt) {
  const bucket = crawlState.sources[evt.source] || (crawlState.sources[evt.source] = {});
  if (evt.listings != null) bucket.listings = evt.listings;
  if (evt.pages != null) bucket.pages = evt.pages;
  if (evt.message) crawlState.message = `${evt.source}: ${evt.message}`;
  if (evt.error) {
    bucket.error = evt.error;
    crawlState.message = `${evt.source}: ${evt.error}`;
  }
}

async function runSource(name, fn, maxPages) {
  crawlState.message = `Rastreando ${name}…`;
  const rows = await fn({ maxPages, onProgress });
  const stats = upsertListings(rows);
  crawlState.inserted += stats.inserted;
  crawlState.updated += stats.updated;
  crawlState.sources[name] = {
    ...(crawlState.sources[name] || {}),
    fetched: rows.length,
    inserted: stats.inserted,
    updated: stats.updated,
  };
  return stats;
}

export async function startCrawl(mode = "quick") {
  if (crawlState.running) return crawlState;
  const pages = MODES[mode] || MODES.quick;
  crawlState.running = true;
  crawlState.mode = mode;
  crawlState.startedAt = new Date().toISOString();
  crawlState.finishedAt = null;
  crawlState.lastError = null;
  crawlState.inserted = 0;
  crawlState.updated = 0;
  resetSources();
  const started = crawlState.startedAt;
  closeOrphanCrawls();
  db.prepare("INSERT INTO crawl_runs (mode, started_at, status) VALUES (?, ?, ?)").run(mode, started, "running");
  const experimental = process.env.CRAWL_EXPERIMENTAL === "1";

  try {
    await runSource("chileautos", scrapeChileautos, pages.chileautos);
    await runSource("yapo", scrapeYapo, pages.yapo);
    await runSource("mercadolibre", scrapeMercadoLibre, pages.mercadolibre);
    await runSource("autocosmos", scrapeAutocosmos, pages.autocosmos);
    await runSource("kavak", scrapeKavak, pages.kavak);
    await runSource("clicar", scrapeClicar, pages.clicar);
    await runSource("checkeados", scrapeCheckeados, pages.checkeados);
    if (experimental) {
      await runSource("facebook", scrapeFacebook, pages.facebook);
      await runSource("autocl", scrapeAutoCl, pages.autocl);
    } else {
      crawlState.sources.facebook = { listings: 0, pages: 0, skipped: "sin sesión; CRAWL_EXPERIMENTAL=1 para forzar" };
      crawlState.sources.autocl = { listings: 0, pages: 0, skipped: "Cloudflare; CRAWL_EXPERIMENTAL=1 para forzar" };
    }
    const expired = deactivateStaleListings();
    crawlState.expired = expired;
    clearCompsCache();
    const snap = writeSnapshot();
    crawlState.status = "ok";
    crawlState.message = `Listo: ${countListings()} avisos · snapshot ${snap?.listings || 0} · dados de baja ${expired.stale + expired.nobrand}`;
    db.prepare(
      "UPDATE crawl_runs SET finished_at = ?, status = ?, stats_json = ? WHERE started_at = ?"
    ).run(
      new Date().toISOString(),
      "ok",
      JSON.stringify({ sources: crawlState.sources, inserted: crawlState.inserted, updated: crawlState.updated }),
      started
    );
  } catch (err) {
    crawlState.lastError = err.message;
    crawlState.message = `Error: ${err.message}`;
    db.prepare("UPDATE crawl_runs SET finished_at = ?, status = ?, stats_json = ? WHERE started_at = ?").run(
      new Date().toISOString(),
      "error",
      JSON.stringify({ error: err.message }),
      started
    );
  } finally {
    crawlState.running = false;
    crawlState.finishedAt = new Date().toISOString();
  }
  return crawlState;
}

export function getCrawlState() {
  return {
    ...crawlState,
    inventory: countListings(),
  };
}
