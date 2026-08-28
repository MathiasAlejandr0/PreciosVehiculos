import { useCallback, useEffect, useMemo, useState } from "react";
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

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("es-CL");

const TONE = {
  emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  lime: "bg-lime-500/15 text-lime-300 ring-lime-500/30",
  sky: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  rose: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  zinc: "bg-white/10 text-slate-300 ring-white/10",
};

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function Badge({ deal }) {
  if (!deal) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${TONE[deal.tone] || TONE.zinc}`}>
      {deal.label}
    </span>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function Card({ row, onOpen }) {
  return (
    <button
      onClick={() => onOpen(row)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1826] text-left transition hover:border-amber-400/40 hover:bg-[#112033]"
    >
      <div className="relative h-36 bg-[#0a1320]">
        {row.image_url ? (
          <img src={row.image_url} alt="" className="h-full w-full object-cover opacity-90 group-hover:opacity-100" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-600">Sin foto</div>
        )}
        <div className="absolute left-2 top-2">
          <Badge deal={row.deal} />
        </div>
        <div className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-200">
          {row.source}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="text-sm font-semibold text-white line-clamp-2">
          {row.brand} {row.model} {row.year || ""}
        </div>
        <div className="text-xs text-slate-400 line-clamp-1">{row.version || row.title}</div>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div className="font-mono text-lg font-semibold text-amber-300">{row.price ? clp.format(row.price) : "—"}</div>
          <div className="text-right text-[11px] text-slate-400">
            {row.mileage != null ? `${num.format(row.mileage)} km` : "km n/d"}
            <div>{row.city || row.region || "Chile"}</div>
          </div>
        </div>
      </div>
    </button>
  );
}

function ChartTip({ active, payload, label, money }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d1826] px-3 py-2 text-xs text-white">
      <div className="text-slate-400">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey}>
          {p.name}: {money ? clp.format(p.value) : num.format(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("mercado");
  const [stats, setStats] = useState(null);
  const [facets, setFacets] = useState({ brands: [], models: [], regions: [], cities: [], sources: [], categories: [] });
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
  const [tasarForm, setTasarForm] = useState({ brand: "Toyota", model: "", year: "2018", mileage: "80000" });
  const [tasarRes, setTasarRes] = useState(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== "" && v != null) p.set(k, v);
    });
    return p.toString();
  }, [filters]);

  const refreshCrawl = useCallback(async () => {
    try {
      setCrawl(await api("/api/crawl"));
    } catch {
      /* ignore */
    }
  }, []);

  const refreshStats = useCallback(async () => {
    if (import.meta.env.PROD) {
      try {
        const r = await fetch("/data/stats.json");
        if (r.ok) {
          const payload = await r.json();
          setStats(payload.stats || payload);
          if (payload.facets) setFacets(payload.facets);
          return;
        }
      } catch {
        /* cae al API local */
      }
    }
    const [s, f] = await Promise.all([api("/api/stats"), api("/api/facets")]);
    setStats(s);
    setFacets(f);
  }, []);

  const refreshListings = useCallback(async () => {
    setListings(await api(`/api/listings?${query}`));
  }, [query]);

  useEffect(() => {
    refreshStats().catch(() => {});
    refreshCrawl();
    const id = setInterval(refreshCrawl, 2500);
    return () => clearInterval(id);
  }, [refreshCrawl, refreshStats]);

  useEffect(() => {
    if (tab === "avisos") refreshListings().catch(() => {});
  }, [tab, refreshListings]);

  useEffect(() => {
    if (crawl && !crawl.running && crawl.inventory) refreshStats().catch(() => {});
  }, [crawl?.running, crawl?.inventory, refreshStats]);

  async function openDetail(row) {
    setDetail(await api(`/api/listings/${encodeURIComponent(row.id)}`));
  }

  async function runCrawl(mode) {
    if (import.meta.env.PROD) return;
    await api("/api/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    refreshCrawl();
  }

  async function doTasar(e) {
    e.preventDefault();
    const p = new URLSearchParams(tasarForm);
    setTasarRes(await api(`/api/tasar?${p}`));
  }

  const modelsForBrand = facets.models.filter((m) => !filters.brand || m.brand === filters.brand);

  return (
    <div className="min-h-screen bg-[#08111c] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#08111c]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <div className="text-lg font-semibold tracking-tight">
              Precio<span className="text-amber-400">Auto</span>
            </div>
            <div className="text-xs text-slate-400">Inteligencia de mercado · vehículos usados Chile</div>
          </div>
          <nav className="flex gap-1 rounded-full bg-white/5 p-1">
            {[
              ["mercado", "Mercado"],
              ["territorio", "Territorio"],
              ["avisos", "Avisos"],
              ["tasador", "Tasador"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`rounded-full px-4 py-1.5 text-sm ${tab === id ? "bg-amber-400 text-black" : "text-slate-300 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
              {import.meta.env.PROD ? (
                <span className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-400">Datos del último snapshot</span>
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
        {crawl ? (
          <div className="border-t border-white/5 bg-black/20 px-4 py-2 text-center text-xs text-slate-400">
            {crawl.running ? (
              <span className="text-amber-300">Rastreando en vivo · {crawl.message}</span>
            ) : (
              <span>
                {num.format(crawl.inventory || 0)} avisos indexados
                {crawl.message ? ` · ${crawl.message}` : ""}
              </span>
            )}
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {tab === "mercado" && stats ? (
          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Avisos activos" value={num.format(stats.totals.listings || 0)} hint="Fuentes públicas de Chile" />
              <Stat label="Precio promedio" value={stats.totals.avg_price ? clp.format(stats.totals.avg_price) : "—"} />
              <Stat label="Más barato" value={stats.totals.min_price ? clp.format(stats.totals.min_price) : "—"} hint={stats.geo?.cheapest?.[0] ? `${stats.geo.cheapest[0].city || stats.geo.cheapest[0].region || ""}` : ""} />
              <Stat label="Más caro" value={stats.totals.max_price ? clp.format(stats.totals.max_price) : "—"} hint={stats.geo?.expensive?.[0] ? `${stats.geo.expensive[0].city || stats.geo.expensive[0].region || ""}` : ""} />
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
                      <button className="text-left hover:text-amber-300" onClick={() => { setFilters((f) => ({ ...f, brand: b.brand, page: 1 })); setTab("avisos"); }}>
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
                    <span className="capitalize">{s.source}</span>
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
                <h2 className="text-sm font-semibold">Oportunidades vs. mediana del mercado</h2>
                <button className="text-xs text-amber-300" onClick={() => setTab("avisos")}>Ver todos los avisos</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stats.opportunities.map((row) => (
                  <Card key={row.id} row={row} onOpen={openDetail} />
                ))}
                {!stats.opportunities.length ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                    Aún no hay comparables suficientes. Lanza un barrido para llenar el mercado.
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "territorio" && stats ? (
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="mb-1 text-sm font-semibold">Portales cubiertos (de mayor a menor volumen)</h2>
              <p className="mb-3 text-xs text-slate-400">Se priorizan Chileautos, Yapo y Mercado Libre; el resto suma precio de automotora y compra directa.</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(stats.catalog || []).map((s) => (
                  <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 p-3 text-sm hover:border-amber-400/40">
                    <div className="font-semibold">{s.priority}. {s.name}</div>
                    <div className="text-xs text-slate-400">{s.listings} · {s.coverage}</div>
                  </a>
                ))}
              </div>
            </section>
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="mb-3 text-sm font-semibold">Más baratos ahora</h2>
                {(stats.geo?.cheapest || []).map((row) => (
                  <a key={row.id} href={row.url} target="_blank" rel="noreferrer" className="mb-2 flex justify-between gap-3 text-sm hover:text-amber-300">
                    <span className="truncate">{row.year} {row.brand} {row.model}</span>
                    <span className="shrink-0 font-mono text-emerald-300">{clp.format(row.price)} · {row.city || row.region || "—"}</span>
                  </a>
                ))}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="mb-3 text-sm font-semibold">Más caros ahora</h2>
                {(stats.geo?.expensive || []).map((row) => (
                  <a key={row.id} href={row.url} target="_blank" rel="noreferrer" className="mb-2 flex justify-between gap-3 text-sm hover:text-amber-300">
                    <span className="truncate">{row.year} {row.brand} {row.model}</span>
                    <span className="shrink-0 font-mono text-rose-300">{clp.format(row.price)} · {row.city || row.region || "—"}</span>
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
                    <th>Más barato</th>
                    <th>Más caro</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.geo?.byCity || []).map((c) => (
                    <tr key={c.name} className="border-t border-white/5">
                      <td className="py-2">
                        <button className="hover:text-amber-300" onClick={() => { setFilters((f) => ({ ...f, city: c.name, page: 1 })); setTab("avisos"); }}>{c.name}</button>
                      </td>
                      <td className="font-mono">{num.format(c.n)}</td>
                      <td className="font-mono text-emerald-300">{clp.format(c.min_price)}</td>
                      <td className="font-mono">{clp.format(c.median)}</td>
                      <td className="font-mono text-rose-300">{clp.format(c.max_price)}</td>
                      <td className="truncate">{c.cheapest?.brand} {c.cheapest?.model}</td>
                      <td className="truncate">{c.expensive?.brand} {c.expensive?.model}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        ) : null}

        {tab === "avisos" ? (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
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
              <a className="block text-center text-xs text-amber-300" href={`/api/export.csv?${query}`}>
                Exportar CSV
              </a>
            </aside>
            <section>
              <div className="mb-3 flex items-center justify-between text-sm text-slate-400">
                <span>{num.format(listings.total)} avisos</span>
                <div className="flex gap-2">
                  <button disabled={listings.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-40">
                    Anterior
                  </button>
                  <button onClick={() => setFilters((f) => ({ ...f, page: (Number(f.page) || 1) + 1 }))} className="rounded-md border border-white/10 px-2 py-1">
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

        {tab === "tasador" ? (
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold">Tasador de mercado</h2>
              <p className="mt-1 text-sm text-slate-400">
                Estima el precio justo a partir de avisos reales (percentiles P25 / mediana / P75), no de listas de concesionario.
              </p>
              <form onSubmit={doTasar} className="mt-4 grid gap-3 sm:grid-cols-2">
                <Select label="Marca" value={tasarForm.brand} onChange={(v) => setTasarForm((f) => ({ ...f, brand: v }))} options={facets.brands} />
                <Select
                  label="Modelo"
                  value={tasarForm.model}
                  onChange={(v) => setTasarForm((f) => ({ ...f, model: v }))}
                  options={facets.models.filter((m) => !tasarForm.brand || m.brand === tasarForm.brand)}
                />
                <Field label="Año" value={tasarForm.year} onChange={(v) => setTasarForm((f) => ({ ...f, year: v }))} />
                <Field label="Kilometraje" value={tasarForm.mileage} onChange={(v) => setTasarForm((f) => ({ ...f, mileage: v }))} />
                <button className="sm:col-span-2 rounded-xl bg-amber-400 py-2 text-sm font-semibold text-black">Tasar con datos reales</button>
              </form>
            </div>
            {tasarRes ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Muestra" value={num.format(tasarRes.sample || 0)} hint="Avisos comparables" />
                <Stat label="Comprar cerca de" value={tasarRes.suggested_buy ? clp.format(tasarRes.suggested_buy) : "—"} hint="Zona P25" />
                <Stat label="Publicar cerca de" value={tasarRes.suggested_list ? clp.format(tasarRes.suggested_list) : "—"} hint="Mediana + 3%" />
                {tasarRes.stats ? (
                  <div className="sm:col-span-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                    Banda de mercado: {clp.format(tasarRes.band.low)} — {clp.format(tasarRes.band.mid)} — {clp.format(tasarRes.band.high)}
                  </div>
                ) : (
                  <div className="sm:col-span-3 text-sm text-slate-400">No hay suficientes avisos para esa combinación. Amplía el barrido o elige otra marca.</div>
                )}
              </div>
            ) : null}
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

function Select({ label, value, onChange, options }) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <select
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Todas</option>
        {options.map((o) => (
          <option key={`${o.brand || ""}-${o.value}`} value={o.value}>
            {o.value} ({o.n})
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
