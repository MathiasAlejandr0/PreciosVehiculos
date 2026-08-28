import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildVehicleReport, parseVehicleQuery, suggestVehicles } from "../../shared/vehicleReport.js";
import { Badge, Card, ChartTip, Field, Select, Stat, clp, num } from "./ui.jsx";

function ExtremeCard({ title, row, tone }) {
  if (!row) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
        {title}: sin avisos suficientes
      </div>
    );
  }
  const href = row.url;
  const inner = (
    <>
      <div className="text-xs uppercase tracking-wide text-slate-400">{title}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${tone}`}>{clp.format(row.price)}</div>
      <div className="mt-1 text-sm text-white">
        {row.year} {row.brand} {row.model}
      </div>
      <div className="mt-1 text-xs text-slate-400">
        {row.city || row.region || "Chile"} · {row.source}
        {row.mileage != null ? ` · ${num.format(row.mileage)} km` : ""}
      </div>
    </>
  );
  const cls = "block rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-amber-400/40";
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export default function SearchHome({ facets, catalog, onOpen }) {
  const [text, setText] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [openSug, setOpenSug] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const boxRef = useRef(null);
  const loadedUrl = useRef(false);

  const suggestions = useMemo(() => suggestVehicles(facets, text || `${brand} ${model}`), [facets, text, brand, model]);
  const modelsForBrand = useMemo(
    () => (facets.models || []).filter((m) => !brand || m.brand === brand),
    [facets.models, brand]
  );
  const popular = useMemo(() => suggestVehicles(facets, ""), [facets]);

  useEffect(() => {
    if (loadedUrl.current || !catalog?.length) return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (!q) return;
    loadedUrl.current = true;
    setText(q);
    runSearch({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  useEffect(() => {
    function hide(e) {
      if (!boxRef.current?.contains(e.target)) setOpenSug(false);
    }
    document.addEventListener("mousedown", hide);
    return () => document.removeEventListener("mousedown", hide);
  }, []);

  function runSearch(next) {
    if (!catalog?.length) {
      setError("Aún estamos cargando el catálogo de avisos.");
      return;
    }
    const parsed = parseVehicleQuery(next.q || text, facets);
    const query = {
      q: next.q ?? text,
      brand: next.brand || parsed.brand || brand,
      model: next.model || parsed.model || model,
      year: next.year || parsed.year || year,
      mileage: next.mileage || mileage,
      facets,
    };
    if (parsed.brand && !brand) setBrand(parsed.brand);
    if (parsed.model && !model) setModel(parsed.model);
    if (parsed.year && !year) setYear(String(parsed.year));
    const built = buildVehicleReport(catalog, query);
    setReport(built);
    setError(built.sample ? "" : "No encontramos avisos para esa búsqueda. Prueba otra marca o quita el año.");
    const label = [query.brand, query.model, query.year].filter(Boolean).join(" ") || query.q;
    const url = new URL(window.location.href);
    if (label) url.searchParams.set("q", label);
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url);
    setOpenSug(false);
  }

  function onSubmit(e) {
    e.preventDefault();
    runSearch({});
  }

  function pickSuggestion(s) {
    setBrand(s.brand || "");
    setModel(s.model || "");
    setText(`${s.brand} ${s.model}`.trim());
    runSearch({ brand: s.brand, model: s.model, q: `${s.brand} ${s.model}` });
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-amber-400/20 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.12),_transparent_42%),linear-gradient(180deg,_#0d1826,_#08111c)] p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Consulta de mercado</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Pon el auto que buscas y te mostramos cuánto vale hoy en Chile
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Más barato, más caro, en qué ciudad está, banda de precio justo y cómo cambia según año y kilometraje — con avisos reales.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div ref={boxRef} className="relative">
            <input
              autoFocus
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setOpenSug(true);
              }}
              onFocus={() => setOpenSug(true)}
              placeholder="Ej. Toyota Yaris 2018, Ranger 2022, Tucson…"
              className="w-full rounded-2xl border border-white/15 bg-black/40 px-5 py-4 text-lg text-white outline-none ring-amber-400/0 placeholder:text-slate-500 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/30"
            />
            {openSug && suggestions.length ? (
              <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d1826] shadow-2xl">
                {suggestions.map((s) => (
                  <button
                    type="button"
                    key={`${s.brand}-${s.model}`}
                    onClick={() => pickSuggestion(s)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-white/5"
                  >
                    <span>
                      {s.brand} {s.model}
                    </span>
                    <span className="font-mono text-xs text-slate-500">{num.format(s.n)} avisos</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select
              label="Marca"
              value={brand}
              onChange={(v) => {
                setBrand(v);
                setModel("");
                setText(v);
              }}
              options={facets.brands || []}
              placeholder="Cualquiera"
            />
            <Select
              label="Modelo"
              value={model}
              onChange={(v) => {
                setModel(v);
                setText([brand, v].filter(Boolean).join(" "));
              }}
              options={modelsForBrand}
              placeholder="Cualquiera"
            />
            <Field label="Año" value={year} onChange={setYear} placeholder="2018" />
            <Field label="Kilometraje (opcional)" value={mileage} onChange={setMileage} placeholder="80000" />
            <button className="mt-5 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300">
              Ver precios de mercado
            </button>
          </div>
        </form>

        {!report && popular.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="text-xs text-slate-500">Búsquedas frecuentes:</span>
            {popular.slice(0, 8).map((s) => (
              <button
                key={`${s.brand}-${s.model}`}
                type="button"
                onClick={() => pickSuggestion(s)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:border-amber-400/40 hover:text-white"
              >
                {s.brand} {s.model}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      {report?.stats ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">{report.label}</h2>
            <p className="text-sm text-slate-400">
              {num.format(report.sample)} avisos comparables · {report.scope}
            </p>
          </div>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Más barato" value={clp.format(report.stats.min)} hint={report.cheapest ? `${report.cheapest.city || report.cheapest.region || "Chile"}` : ""} />
            <Stat label="Comprar cerca de" value={report.suggested_buy ? clp.format(report.suggested_buy) : "—"} hint="Zona P25 del mercado" />
            <Stat label="Precio justo (mediana)" value={clp.format(report.stats.p50)} hint="La mitad está bajo este valor" />
            <Stat label="Más caro" value={clp.format(report.stats.max)} hint={report.expensive ? `${report.expensive.city || report.expensive.region || "Chile"}` : ""} />
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <ExtremeCard title="El más barato ahora" row={report.cheapest} tone="text-emerald-300" />
            <ExtremeCard title="El más caro ahora" row={report.expensive} tone="text-rose-300" />
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            Banda de mercado: {clp.format(report.band.low)} — {clp.format(report.band.mid)} — {clp.format(report.band.high)}
            {report.suggested_list ? ` · Si publicas, cerca de ${clp.format(report.suggested_list)}` : ""}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold">Evolución por año modelo</h3>
              <div className="h-56">
                {report.byYear.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.byYear}>
                      <CartesianGrid stroke="#1f2d40" vertical={false} />
                      <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1e6)}M`} />
                      <Tooltip content={<ChartTip money />} />
                      <Line type="monotone" dataKey="min_price" name="Mínimo" stroke="#34d399" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="median" name="Mediana" stroke="#fbbf24" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="max_price" name="Máximo" stroke="#fb7185" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold">Precio según kilometraje</h3>
              <div className="h-56">
                {report.byKm.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.byKm}>
                      <CartesianGrid stroke="#1f2d40" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1e6)}M`} />
                      <Tooltip content={<ChartTip money />} />
                      <Bar dataKey="min_price" name="Mínimo" fill="#34d399" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="median" name="Mediana" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold">Precio vs. kilómetros</h3>
              <div className="h-56">
                {report.scatter.length > 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid stroke="#1f2d40" />
                      <XAxis dataKey="mileage" name="Km" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <YAxis dataKey="price" name="Precio" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1e6)}M`} />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-white/10 bg-[#0d1826] px-3 py-2 text-xs">
                              <div>{p.label}</div>
                              <div>{clp.format(p.price)} · {num.format(p.mileage)} km</div>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={report.scatter} fill="#38bdf8" fillOpacity={0.75} />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold">Mínimo / mediana / máximo por región</h3>
              <div className="h-56">
                {report.byRegion.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.byRegion}>
                      <CartesianGrid stroke="#1f2d40" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} interval={0} angle={-25} textAnchor="end" height={70} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1e6)}M`} />
                      <Tooltip content={<ChartTip money />} />
                      <Bar dataKey="min_price" name="Mínimo" fill="#34d399" />
                      <Bar dataKey="median" name="Mediana" fill="#fbbf24" />
                      <Bar dataKey="max_price" name="Máximo" fill="#fb7185" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>
          </section>

          {report.byCity.length ? (
            <section className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold">Dónde está más barato y más caro</h3>
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
                  {report.byCity.map((c) => (
                    <tr key={c.name} className="border-t border-white/5">
                      <td className="py-2">{c.name}</td>
                      <td className="font-mono">{num.format(c.n)}</td>
                      <td className="font-mono text-emerald-300">{clp.format(c.min_price)}</td>
                      <td className="font-mono">{clp.format(c.median)}</td>
                      <td className="font-mono text-rose-300">{clp.format(c.max_price)}</td>
                      <td className="truncate text-slate-400">{c.cheapest?.year} · {clp.format(c.cheapest?.price || 0)}</td>
                      <td className="truncate text-slate-400">{c.expensive?.year} · {clp.format(c.expensive?.price || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-3">
            <MiniList title="Por portal" rows={report.bySource} />
            <MiniList title="Combustible" rows={report.byFuel} />
            <MiniList title="Transmisión" rows={report.byTransmission} />
          </section>

          {report.opportunities.length ? (
            <section>
              <h3 className="mb-3 text-sm font-semibold">Oportunidades de este modelo (bajo la mediana)</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {report.opportunities.map((row) => (
                  <Card key={row.id} row={row} onOpen={onOpen} />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Avisos de menor a mayor precio</h3>
              <span className="text-xs text-slate-500">Hasta 60 resultados</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {report.listings.map((row) => (
                <Card key={row.id} row={row} onOpen={onOpen} />
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {!report && !catalog?.length ? (
        <div className="py-12 text-center text-slate-400">Cargando catálogo para consultar al instante…</div>
      ) : null}
    </div>
  );
}

function EmptyChart() {
  return <div className="flex h-full items-center justify-center text-sm text-slate-500">Pocos avisos para graficar esta dimensión.</div>;
}

function MiniList({ title, rows }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {rows?.length ? (
        rows.map((r) => (
          <div key={r.name} className="mb-2 flex justify-between text-sm">
            <span className="truncate pr-3 capitalize">{r.name}</span>
            <span className="font-mono text-slate-400">
              {num.format(r.n)} · {clp.format(r.median)}
            </span>
          </div>
        ))
      ) : (
        <div className="text-sm text-slate-500">Sin dato en los avisos.</div>
      )}
    </div>
  );
}
