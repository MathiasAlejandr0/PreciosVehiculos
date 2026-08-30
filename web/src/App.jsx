import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { filterListings } from "../../shared/vehicleReport.js";
import { buildMarketIntel } from "../../shared/intelligence.js";
import { overviewFromRows } from "../../shared/overview.js";
import { sanitizeListing, facetsFromRows } from "../../shared/cleanListing.js";
import { parseLocation } from "../../server/lib/geo.js";
import { FB_CITIES, facebookVehiclesUrl } from "../../shared/facebook.js";
import { valueVehicle } from "../../shared/valuation.js";
import SearchHome from "./SearchHome.jsx";
import ValuationPanel from "./ValuationPanel.jsx";
import { Badge, Card, ChartTip, Field, Select, SOURCE_NAME, Stat, clp, num } from "./ui.jsx";

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function App() {
  const [tab, setTab] = useState("buscar");
  const [seen, setSeen] = useState({ buscar: true });
  const crawlRunning = useRef(false);
  const scrollByTab = useRef({ buscar: 0, mercado: 0, territorio: 0, avisos: 0 });
  const [stats, setStats] = useState(null);
  const [facets, setFacets] = useState({
    brands: [],
    models: [],
    versions: [],
    fuels: [],
    transmissions: [],
    regions: [],
    cities: [],
    sources: [],
    categories: [],
  });
  const [catalog, setCatalog] = useState(null);
  const [snapAt, setSnapAt] = useState(null);
  const [crawl, setCrawl] = useState(null);
  const [listings, setListings] = useState({ rows: [], total: 0, page: 1 });
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({
    q: "",
    brand: "",
    model: "",
    category: "",
    source: "",
    region: "",
    city: "",
    year_min: "",
    year_max: "",
    price_min: "",
    price_max: "",
    km_max: "",
    sort: "recent",
    page: 1,
  });

  const intel = useMemo(() => (catalog?.length ? buildMarketIntel(catalog) : null), [catalog]);
  const liveOverview = useMemo(
    () => (catalog?.length ? overviewFromRows(catalog, { catalog: stats?.catalog || [] }) : null),
    [catalog, stats?.catalog]
  );
  const detailValuation = useMemo(() => {
    if (!detail || !catalog?.length) return null;
    const kind =
      detail.category === "moto" ? "moto" : detail.category === "camion" ? "camion" : "livianos";
    return valueVehicle(catalog, {
      brand: detail.brand,
      model: detail.model,
      year: detail.year,
      mileage: detail.mileage,
      version: detail.version,
      fuel: detail.fuel,
      transmission: detail.transmission,
      kind,
    });
  }, [detail, catalog]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== "" && v != null) p.set(k, v);
    });
    return p.toString();
  }, [filters]);

  const goTab = useCallback((id) => {
    setSeen((s) => (s[id] ? s : { ...s, [id]: true }));
    setTab((prev) => {
      if (prev === id) return prev;
      scrollByTab.current[prev] = window.scrollY;
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollByTab.current[id] || 0, left: 0, behavior: "instant" });
      });
      return id;
    });
  }, []);

  const refreshCrawl = useCallback(async () => {
    try {
      const next = await api("/api/crawl");
      setCrawl((prev) => {
        if (
          prev &&
          prev.running === next.running &&
          prev.message === next.message &&
          prev.inventory === next.inventory
        ) {
          return prev;
        }
        return next;
      });
      return next;
    } catch {
      return null;
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const r = await fetch("/data/stats.json");
      if (r.ok) {
        const payload = await r.json();
        setStats(payload.stats || payload);
        if (payload.generatedAt) setSnapAt(payload.generatedAt);
        return;
      }
    } catch {
      /* cae al API local */
    }
    const s = await api("/api/stats");
    setStats(s);
  }, []);

  useEffect(() => {
    fetch("/data/listings.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const rows = (d.rows || []).map((row) => sanitizeListing(row, parseLocation)).filter(Boolean);
        setCatalog(rows);
        setFacets(facetsFromRows(rows));
        if (d.generatedAt) setSnapAt(d.generatedAt);
      })
      .catch(() => setCatalog([]));
  }, []);

  const refreshListings = useCallback(async () => {
    if (catalog?.length) {
      setListings(filterListings(catalog, filters));
      return;
    }
    setListings(await api(`/api/listings?${query}`));
  }, [catalog, filters, query]);

  useEffect(() => {
    refreshStats().catch(() => {});
    refreshCrawl();
  }, [refreshCrawl, refreshStats]);

  useEffect(() => {
    if (!crawl?.running) return undefined;
    const id = setInterval(refreshCrawl, 2500);
    return () => clearInterval(id);
  }, [crawl?.running, refreshCrawl]);

  useEffect(() => {
    if (crawlRunning.current && crawl && !crawl.running) {
      refreshStats().catch(() => {});
    }
    crawlRunning.current = Boolean(crawl?.running);
  }, [crawl?.running, refreshStats]);

  useEffect(() => {
    if (tab === "avisos") refreshListings().catch(() => {});
  }, [tab, refreshListings]);

  const openDetail = useCallback(async (row) => {
    setDetail(row);
    if (import.meta.env.PROD) return;
    try {
      setDetail(await api(`/api/listings/${encodeURIComponent(row.id)}`));
    } catch {
      /* nos quedamos con el aviso del catálogo */
    }
  }, []);

  async function runCrawl(mode) {
    if (import.meta.env.PROD) return;
    await api("/api/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    refreshCrawl();
  }

  const modelsForBrand = facets.models.filter((m) => !filters.brand || m.brand === filters.brand);

  return (
    <div className="min-h-screen bg-[#08111c] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#08111c]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <button className="text-left" onClick={() => goTab("buscar")}>
            <div className="text-lg font-semibold tracking-tight">
              Precio<span className="text-amber-400">Auto</span>
            </div>
            <div className="text-xs text-slate-400">Inteligencia de mercado · vehículos usados Chile</div>
          </button>
          <nav className="flex gap-1 overflow-x-auto rounded-full bg-white/5 p-1">
            {[
              ["buscar", "Buscar"],
              ["mercado", "Mercado"],
              ["territorio", "Territorio"],
              ["avisos", "Avisos"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => goTab(id)}
                className={`rounded-full px-4 py-1.5 text-sm whitespace-nowrap ${tab === id ? "bg-amber-400 text-black" : "text-slate-300 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {import.meta.env.PROD ? (
              <span className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-400">
                {snapAt
                  ? `Snapshot ${new Date(snapAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}`
                  : "Datos del último snapshot"}
              </span>
            ) : (
              <>
                <button onClick={() => runCrawl("quick")} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:border-amber-400/50">
                  Barrido rápido
                </button>
                <button onClick={() => runCrawl("standard")} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black">
                  Actualizar mercado
                </button>
              </>
            )}
          </div>
        </div>
        <div className="min-h-9 border-t border-white/5 bg-black/20 px-4 py-2 text-center text-xs text-slate-400">
          {crawl?.running ? (
            <span className="text-amber-300">Rastreando en vivo · {crawl.message}</span>
          ) : (
            <span>
              {num.format(catalog?.length || stats?.totals?.listings || crawl?.inventory || 0)} avisos indexados
              {snapAt ? ` · ${new Date(snapAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}` : ""}
              {crawl?.message && crawl.message !== "En espera" ? ` · ${crawl.message}` : ""}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {seen.buscar ? (
          <div hidden={tab !== "buscar"}>
            <SearchHome facets={facets} catalog={catalog} onOpen={openDetail} />
          </div>
        ) : null}

        {seen.mercado && stats ? (
          <div hidden={tab !== "mercado"} className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Avisos indexados"
                value={num.format(stats.totals.listings || 0)}
                hint={stats.totals.livianos != null ? `${num.format(stats.totals.livianos)} livianos tasables` : "Todas las categorías"}
              />
              <Stat
                label="Precio promedio livianos"
                value={stats.totals.avg_price ? clp.format(stats.totals.avg_price) : "—"}
                hint="Solo autos, SUV y comerciales"
              />
              <Stat
                label="Mejor oportunidad"
                value={intel?.bestDeal?.price ? clp.format(intel.bestDeal.price) : "—"}
                hint={intel?.bestDeal ? `${intel.bestDeal.year} ${intel.bestDeal.brand} ${intel.bestDeal.model} · ${intel.bestDeal.delta_pct}% vs su año` : "Mismo modelo y año"}
              />
              <Stat
                label="Más sobreprecio vs su par"
                value={intel?.worstDeal?.price ? clp.format(intel.worstDeal.price) : "—"}
                hint={intel?.worstDeal ? `${intel.worstDeal.year} ${intel.worstDeal.brand} ${intel.worstDeal.model} · +${intel.worstDeal.delta_pct}% vs su año` : "No es el auto más caro del país"}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="mb-3 text-sm font-semibold">Inventario por año</h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.yearHist}>
                      <CartesianGrid stroke="#1f2d40" vertical={false} />
                      <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="n" name="Avisos" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="mb-3 text-sm font-semibold">Precio promedio por año</h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.yearHist}>
                      <CartesianGrid stroke="#1f2d40" vertical={false} />
                      <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1e6)}M`} />
                      <Tooltip content={<ChartTip money />} />
                      <Line type="monotone" dataKey="avg_price" name="Precio" stroke="#38bdf8" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="mb-3 text-sm font-semibold">Evolución / curva de precio por año modelo</h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.series?.byYear || stats.yearHist}>
                      <CartesianGrid stroke="#1f2d40" vertical={false} />
                      <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1e6)}M`} />
                      <Tooltip content={<ChartTip money />} />
                      <Line type="monotone" dataKey="min_price" name="Mínimo" stroke="#34d399" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="avg_price" name="Promedio" stroke="#38bdf8" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="max_price" name="Máximo" stroke="#fb7185" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="mb-3 text-sm font-semibold">Histórico de publicaciones (mediana diaria)</h2>
                <div className="h-56">
                  {(stats.series?.daily || []).length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.series.daily}>
                        <CartesianGrid stroke="#1f2d40" vertical={false} />
                        <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1e6)}M`} />
                        <Tooltip content={<ChartTip money />} />
                        <Line type="monotone" dataKey="avg_price" name="Precio" stroke="#fbbf24" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
                      La serie diaria se arma con cada barrido. Corre actualizaciones sucesivas para ver la fluctuación real.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="mb-3 text-sm font-semibold">Marcas con más oferta</h2>
                <div className="space-y-2">
                  {stats.topBrands.map((b) => (
                    <div key={b.brand} className="flex items-center justify-between text-sm">
                      <button className="text-left hover:text-amber-300" onClick={() => { setFilters((f) => ({ ...f, brand: b.brand, page: 1 })); goTab("avisos"); }}>
                        {b.brand}
                      </button>
                      <span className="font-mono text-slate-400">{num.format(b.n)} · {clp.format(b.avg_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="mb-3 text-sm font-semibold">Por portal</h2>
                {stats.bySource.map((s) => (
                  <div key={s.source} className="mb-2 flex justify-between text-sm">
                    <span className="capitalize">{SOURCE_NAME[s.source] || s.source}</span>
                    <span className="font-mono text-slate-400">{num.format(s.n)}</span>
                  </div>
                ))}
                <h2 className="mb-3 mt-6 text-sm font-semibold">Categorías</h2>
                {stats.byCategory.map((s) => (
                  <div key={s.category} className="mb-2 flex justify-between text-sm">
                    <span className="capitalize">{s.category || "otro"}</span>
                    <span className="font-mono text-slate-400">{num.format(s.n)}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="mb-3 text-sm font-semibold">Regiones</h2>
                {stats.byRegion.slice(0, 12).map((s) => (
                  <div key={s.region} className="mb-2 flex justify-between text-sm">
                    <span className="truncate pr-3">{s.region}</span>
                    <span className="font-mono text-slate-400">{num.format(s.n)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Oportunidades únicas vs. su modelo y año</h2>
                <button className="text-xs text-amber-300" onClick={() => goTab("avisos")}>Ver todos los avisos</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(intel?.opportunities || stats.opportunities || []).map((row) => (
                  <Card key={row.id} row={row} onOpen={openDetail} />
                ))}
                {!(intel?.opportunities || stats.opportunities || []).length ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                    Aún no hay comparables suficientes. Lanza un barrido para llenar el mercado.
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {seen.territorio && stats ? (
          <div hidden={tab !== "territorio"} className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="mb-1 text-sm font-semibold">Portales cubiertos (de mayor a menor volumen)</h2>
              <p className="mb-3 text-xs text-slate-400">Se priorizan Chileautos, Yapo, Mercado Libre y Facebook Marketplace. Kavak, Clicar, Checkeados y auto.cl aportan precio de automotora, seminuevos inspeccionados y financiamiento.</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(stats.catalog || []).map((s) => (
                  <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 p-3 text-sm hover:border-amber-400/40">
                    <div className="font-semibold">{s.priority}. {s.name}</div>
                    <div className="text-xs text-slate-400">{s.listings} · {s.coverage}</div>
                  </a>
                ))}
              </div>
            </section>
            {(liveOverview?.vehicles?.brands || []).length ? (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="mb-1 text-sm font-semibold">Catálogo canónico (inferido de avisos)</h2>
                <p className="mb-3 text-xs text-slate-400">
                  Marca → modelo → generación (hueco de años) y versiones más frecuentes. No es un catálogo de fábrica.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {liveOverview.vehicles.brands.slice(0, 8).map((b) => (
                    <div key={b.brand} className="rounded-xl border border-white/10 p-3 text-sm">
                      <div className="font-semibold">{b.brand}</div>
                      <div className="text-[11px] text-slate-500">{num.format(b.n)} avisos</div>
                      <ul className="mt-2 space-y-1 text-xs text-slate-300">
                        {b.models.slice(0, 4).map((m) => (
                          <li key={m.model}>
                            {m.model}
                            {m.generations?.length
                              ? ` · ${m.generations.map((g) => `${g.from}–${g.to}`).join(", ")}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <section className="rounded-2xl border border-[#1877f2]/30 bg-[#1877f2]/10 p-4">
              <h2 className="mb-1 text-sm font-semibold">Facebook Marketplace por ciudad</h2>
              <p className="mb-3 text-xs text-slate-400">
                Avisos de particulares. Ábrelos en Facebook; el portal pide sesión y bloquea el barrido automático.
              </p>
              <div className="flex flex-wrap gap-2">
                {FB_CITIES.map((c) => (
                  <a
                    key={c.slug}
                    href={facebookVehiclesUrl(c.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/15 px-3 py-1 text-xs hover:border-[#1877f2] hover:text-white"
                  >
                    {c.name}
                  </a>
                ))}
              </div>
            </section>
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="mb-1 text-sm font-semibold">Mejor precio vs su modelo y año</h2>
                <p className="mb-3 text-xs text-slate-500">No es el auto más barato del país: es el que más se desvía a la baja frente a pares del mismo año.</p>
                {(intel?.opportunities || stats.geo?.cheapest || []).map((row) => (
                  <a key={row.id} href={row.url} target="_blank" rel="noreferrer" className="mb-2 flex justify-between gap-3 text-sm hover:text-amber-300">
                    <span className="truncate">{row.year} {row.brand} {row.model}</span>
                    <span className="shrink-0 font-mono text-emerald-300">{clp.format(row.price)}{row.delta_pct != null ? ` · ${row.delta_pct}%` : ""}</span>
                  </a>
                ))}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="mb-1 text-sm font-semibold">Más caros vs su modelo y año</h2>
                <p className="mb-3 text-xs text-slate-500">Sobreprecio frente a la mediana de ese mismo modelo y año, no un auto de lujo suelto.</p>
                {(intel?.overpriced || stats.geo?.expensive || []).map((row) => (
                  <a key={row.id} href={row.url} target="_blank" rel="noreferrer" className="mb-2 flex justify-between gap-3 text-sm hover:text-amber-300">
                    <span className="truncate">{row.year} {row.brand} {row.model}</span>
                    <span className="shrink-0 font-mono text-rose-300">{clp.format(row.price)}{row.delta_pct != null ? ` · +${row.delta_pct}%` : ""}</span>
                  </a>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="mb-3 text-sm font-semibold">Mediana, mínimo y máximo por región</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.geo?.byRegion || []}>
                    <CartesianGrid stroke="#1f2d40" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} interval={0} angle={-25} textAnchor="end" height={70} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1e6)}M`} />
                    <Tooltip content={<ChartTip money />} />
                    <Bar dataKey="min_price" name="Mínimo" fill="#34d399" />
                    <Bar dataKey="median" name="Mediana" fill="#fbbf24" />
                    <Bar dataKey="max_price" name="Máximo" fill="#fb7185" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="mb-3 text-sm font-semibold">Ciudades</h2>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="pb-2">Ciudad</th>
                    <th>Avisos</th>
                    <th>Mínimo</th>
                    <th>Mediana</th>
                    <th>Máximo</th>
                    <th>Mejor trato</th>
                    <th>Más caro vs par</th>
                  </tr>
                </thead>
                <tbody>
                  {(liveOverview?.geo?.byCity || stats.geo?.byCity || []).map((c) => (
                    <tr key={c.name} className="border-t border-white/5">
                      <td className="py-2">
                        <button className="hover:text-amber-300" onClick={() => { setFilters((f) => ({ ...f, city: c.name, page: 1 })); goTab("avisos"); }}>{c.name}</button>
                      </td>
                      <td className="font-mono">{num.format(c.n)}</td>
                      <td className="font-mono text-emerald-300">{clp.format(c.min_price)}</td>
                      <td className="font-mono">{clp.format(c.median)}</td>
                      <td className="font-mono text-rose-300">{clp.format(c.max_price)}</td>
                      <td className="truncate">{c.cheapest?.year} {c.cheapest?.brand} {c.cheapest?.model}{c.cheapest?.delta_pct != null ? ` · ${c.cheapest.delta_pct}%` : ""}</td>
                      <td className="truncate">{c.expensive?.year} {c.expensive?.brand} {c.expensive?.model}{c.expensive?.delta_pct != null ? ` · ${c.expensive.delta_pct}%` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        ) : null}

        {seen.avisos ? (
          <div hidden={tab !== "avisos"} className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <aside className="h-fit space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <input
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                placeholder="Buscar marca, modelo…"
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
              />
              <Select label="Marca" value={filters.brand} onChange={(v) => setFilters((f) => ({ ...f, brand: v, model: "", page: 1 }))} options={facets.brands} />
              <Select label="Modelo" value={filters.model} onChange={(v) => setFilters((f) => ({ ...f, model: v, page: 1 }))} options={modelsForBrand} />
              <Select label="Categoría" value={filters.category} onChange={(v) => setFilters((f) => ({ ...f, category: v, page: 1 }))} options={facets.categories} />
              <Select label="Portal" value={filters.source} onChange={(v) => setFilters((f) => ({ ...f, source: v, page: 1 }))} options={facets.sources} />
              <Select label="Región" value={filters.region} onChange={(v) => setFilters((f) => ({ ...f, region: v, page: 1 }))} options={facets.regions} />
              <Select label="Ciudad" value={filters.city} onChange={(v) => setFilters((f) => ({ ...f, city: v, page: 1 }))} options={facets.cities || []} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Año desde" value={filters.year_min} onChange={(v) => setFilters((f) => ({ ...f, year_min: v, page: 1 }))} />
                <Field label="Año hasta" value={filters.year_max} onChange={(v) => setFilters((f) => ({ ...f, year_max: v, page: 1 }))} />
                <Field label="Precio min" value={filters.price_min} onChange={(v) => setFilters((f) => ({ ...f, price_min: v, page: 1 }))} />
                <Field label="Precio max" value={filters.price_max} onChange={(v) => setFilters((f) => ({ ...f, price_max: v, page: 1 }))} />
                <Field label="Km máx" value={filters.km_max} onChange={(v) => setFilters((f) => ({ ...f, km_max: v, page: 1 }))} />
              </div>
              <select
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                value={filters.sort}
                onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value, page: 1 }))}
              >
                <option value="recent">Más recientes</option>
                <option value="price_asc">Menor precio</option>
                <option value="price_desc">Mayor precio</option>
                <option value="year_desc">Más nuevos</option>
                <option value="km_asc">Menor km</option>
              </select>
              {!import.meta.env.PROD ? (
                <a className="block text-center text-xs text-amber-300" href={`/api/export.csv?${query}`}>
                  Exportar CSV
                </a>
              ) : null}
            </aside>
            <section>
              <div className="mb-3 flex items-center justify-between text-sm text-slate-400">
                <span>{num.format(listings.total)} avisos</span>
                <div className="flex gap-2">
                  <button disabled={listings.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-40">
                    Anterior
                  </button>
                  <button
                    disabled={(listings.page || 1) * (listings.limit || 24) >= (listings.total || 0)}
                    onClick={() => setFilters((f) => ({ ...f, page: (Number(f.page) || 1) + 1 }))}
                    className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {listings.rows.map((row) => (
                  <Card key={row.id} row={row} onOpen={openDetail} />
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {!stats && tab === "mercado" ? (
          <div className="py-20 text-center text-slate-400">
            {crawl?.running ? "Indexando el mercado chileno…" : "Cargando panel…"}
          </div>
        ) : null}
      </main>

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" onClick={() => setDetail(null)}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-t-3xl border border-white/10 bg-[#0d1826] p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">{detail.source} · {detail.city || detail.region}</div>
                <h3 className="text-xl font-semibold">{detail.brand} {detail.model} {detail.year}</h3>
                <div className="mt-1 text-sm text-slate-400">{detail.title}</div>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400">Cerrar</button>
            </div>
            {detail.image_url ? <img src={detail.image_url} alt="" className="mt-4 h-56 w-full rounded-xl object-cover" /> : null}
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div className="font-mono text-3xl text-amber-300">{clp.format(detail.price || 0)}</div>
              <Badge deal={detail.deal} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300 sm:grid-cols-4">
              <div>Km: {detail.mileage != null ? num.format(detail.mileage) : "n/d"}</div>
              <div>Combustible: {detail.fuel || "n/d"}</div>
              <div>Cambio: {detail.transmission || "n/d"}</div>
              <div>Vendedor: {detail.seller_type || "n/d"}</div>
            </div>
            {detail.market ? (
              <div className="mt-4 rounded-xl bg-white/5 p-3 text-sm">
                Mediana comparable: {clp.format(detail.market.p50)} ({detail.market.n} avisos) · Δ {detail.delta_pct}%
              </div>
            ) : null}
            {detailValuation?.retail ? (
              <div className="mt-4">
                <ValuationPanel valuation={detailValuation} />
              </div>
            ) : null}
            {detail.history?.length > 1 ? (
              <div className="mt-4 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={detail.history}>
                    <XAxis dataKey="seen_at" hide />
                    <YAxis hide />
                    <Tooltip content={<ChartTip money />} />
                    <Line type="monotone" dataKey="price" stroke="#fbbf24" dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : null}
            {detail.comps?.length ? (
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-semibold">Comparables</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {detail.comps.map((c) => (
                    <a key={c.id} href={c.url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 p-2 text-sm hover:border-amber-400/40">
                      {c.year} {c.brand} {c.model} · {clp.format(c.price)} · {c.source}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {detail.url ? (
              <a href={detail.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-black">
                Ver aviso original
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
