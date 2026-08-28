import express from "express";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { db, countListings } from "./db.js";
import { getOverview, getFacets, searchListings, getListing, tasar } from "./analytics.js";
import { startCrawl, getCrawlState } from "./crawl.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 8787);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, inventory: countListings(), time: new Date().toISOString() });
});

app.get("/api/stats", (_req, res) => {
  res.json(getOverview());
});

app.get("/api/facets", (_req, res) => {
  res.json(getFacets());
});

app.get("/api/listings", (req, res) => {
  res.json(searchListings(req.query));
});

app.get("/api/listings/:id", (req, res) => {
  const row = getListing(req.params.id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  res.json(row);
});

app.get("/api/tasar", (req, res) => {
  if (!req.query.brand) return res.status(400).json({ error: "Falta marca" });
  res.json(tasar(req.query));
});

app.get("/api/crawl", (_req, res) => {
  res.json(getCrawlState());
});

app.post("/api/crawl", async (req, res) => {
  const mode = req.body?.mode || "quick";
  if (!["quick", "standard", "full"].includes(mode)) {
    return res.status(400).json({ error: "Modo inválido" });
  }
  if (getCrawlState().running) return res.json(getCrawlState());
  startCrawl(mode).catch((err) => {
    console.error("crawl", err);
  });
  res.json({ ok: true, ...getCrawlState() });
});

app.get("/api/export.csv", (req, res) => {
  const { rows } = searchListings({ ...req.query, limit: 5000, page: 1 });
  const cols = [
    "source", "title", "brand", "model", "year", "mileage", "price", "region",
    "fuel", "transmission", "seller_type", "url", "delta_pct",
  ];
  const lines = [cols.join(",")];
  for (const row of rows) {
    lines.push(cols.map((c) => `"${String(row[c] ?? "").replaceAll('"', '""')}"`).join(","));
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=precioauto.csv");
  res.send("\ufeff" + lines.join("\n"));
});

const dist = join(__dirname, "..", "web", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(join(dist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`PrecioAuto API en http://localhost:${PORT}`);
  const n = countListings();
  if (n === 0) {
    console.log("Inventario vacío: iniciando barrido rápido del mercado…");
    startCrawl("quick").catch((err) => console.error(err));
  }
});
