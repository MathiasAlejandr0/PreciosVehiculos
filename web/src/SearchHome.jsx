import { memo, useEffect, useMemo, useRef, useState } from "react";
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
import { buildVehicleReport, parseSmartQuery, suggestVehicles } from "../../shared/vehicleReport.js";
import { uniqueOpportunities } from "../../shared/intelligence.js";
import { facetsFromRows, matchesKind } from "../../shared/cleanListing.js";
import { buildVehicleCatalog, generationsFor } from "../../shared/catalog.js";
import { valueVehicle } from "../../shared/valuation.js";
import { portalSearchLinks } from "../../shared/portals.js";
import { Badge, Card, ChartTip, Field, Select, SOURCE_NAME, Stat, clp, num } from "./ui.jsx";
import ValuationPanel, { RuleToggles } from "./ValuationPanel.jsx";

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
        {row.city || row.region || "Chile"} · {SOURCE_NAME[row.source] || row.source}
        {row.mileage != null ? ` · ${num.format(row.mileage)} km` : ""}
        {row.peer_n ? ` · ${row.peer_n} pares` : ""}
        {row.delta_pct != null ? ` · ${row.delta_pct > 0 ? "+" : ""}${row.delta_pct}% vs mediana` : ""}
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

function SearchHome({ facets, catalog, onOpen }) {
  const [text, setText] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [version, setVersion] = useState("");
  const [fuel, setFuel] = useState("");
  const [transmission, setTransmission] = useState("");
  const [rules, setRules] = useState({});
  const [kind, setKind] = useState("livianos");
  const [openSug, setOpenSug] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const boxRef = useRef(null);
  const loadedUrl = useRef(false);

  const scoped = useMemo(
    () => (catalog || []).filter((r) => matchesKind(r, kind)),
    [catalog, kind]
  );
  const localFacets = useMemo(() => (scoped.length ? facetsFromRows(scoped) : facets), [scoped, facets]);
  const suggestions = useMemo(() => suggestVehicles(localFacets, text || `${brand} ${model}`), [localFacets, text, brand, model]);
  const modelsForBrand = useMemo(
    () => (localFacets.models || []).filter((m) => !brand || m.brand === brand),
    [localFacets.models, brand]
  );
  const popular = useMemo(() => suggestVehicles(localFacets, ""), [localFacets]);
  const liveOpps = useMemo(() => uniqueOpportunities(scoped, { limit: 8, minPeers: 4 }), [scoped]);
  const versionsForModel = useMemo(
    () =>
      (localFacets.versions || [])
        .filter((v) => (!brand || v.brand === brand) && (!model || v.model === model))
        .slice(0, 40),
    [localFacets.versions, brand, model]
  );
  const vehicleTree = useMemo(() => (catalog?.length ? buildVehicleCatalog(catalog) : null), [catalog]);
  const liveValuation = useMemo(() => {
    if (!catalog?.length || !report) return report?.valuation || null;
    return valueVehicle(scoped.length ? scoped : catalog, {
      ...report.query,
      version,
      fuel,
      transmission,
      mileage: mileage || report.query?.mileage,
      rules,
      kind: report.query?.kind || kind,
      year: report.query?.year || report.peer_year,
    });
  }, [catalog, scoped, report, version, fuel, transmission, mileage, rules, kind]);
  const generation = useMemo(
    () => generationsFor(vehicleTree, report?.query?.brand || brand, report?.query?.model || model),
    [vehicleTree, report, brand, model]
  );

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
    const parsed = parseSmartQuery(next.q || text, localFacets);
    const query = {
      q: next.q ?? text,
      brand: next.brand || parsed.brand || brand,
      model: next.model || parsed.model || model,
      year: next.year || parsed.year || year,
      yearMin: parsed.yearMin,
      yearMax: parsed.yearMax,
      budgetMax: parsed.budgetMax,
      kmMax: parsed.kmMax,
      category: parsed.category,
      intent: parsed.intent,
      mileage: next.mileage || mileage,
      version: next.version ?? version,
      fuel: next.fuel ?? fuel,
      transmission: next.transmission ?? transmission,
      rules: next.rules || rules,
      kind: next.kind || kind,
      facets: localFacets,
      catalog: vehicleTree,
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
    const nextPath = `${url.pathname}${url.search}${url.hash}`;
    const now = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextPath !== now) window.history.replaceState({}, "", nextPath);
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
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Consulta inteligente</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Pon el auto que buscas y te mostramos cuánto vale hoy en Chile
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Tres precios (retoma, publicar y techo) sobre avisos públicos. Ask no es transferencia. Entiende “SUV hasta 15 millones 2018-2021”.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div ref={boxRef} className="relative">
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setOpenSug(true);
              }}
              onFocus={() => setOpenSug(true)}
              placeholder="Ej. Toyota Yaris 2018, SUV hasta 15 millones 2019-2021, oportunidad Ranger…"
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Select
              label="Tipo"
              value={kind}
              onChange={(v) => {
                setKind(v);
                setBrand("");
                setModel("");
                setReport(null);
                setError("");
              }}
              options={[
                { value: "livianos", label: "Autos y SUV" },
                { value: "moto", label: "Motos" },
                { value: "camion", label: "Camiones" },
                { value: "all", label: "Todo el inventario" },
              ]}
              allowEmpty={false}
            />
            <Select
              label="Marca"
              value={brand}
              onChange={(v) => {
                setBrand(v);
                setModel("");
                setText(v);
              }}
              options={localFacets.brands || []}
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Versión / motor"
              value={version}
              onChange={setVersion}
              options={versionsForModel}
              placeholder="Cualquiera"
            />
            <Select
              label="Combustible"
              value={fuel}
              onChange={setFuel}
              options={localFacets.fuels || []}
              placeholder="Cualquiera"
            />
            <Select
              label="Transmisión"
              value={transmission}
              onChange={setTransmission}
              options={localFacets.transmissions || []}
              placeholder="Cualquiera"
            />
          </div>
          <div>
            <div className="mb-2 text-xs text-slate-400">Estado del auto (ajusta la tasación)</div>
            <RuleToggles rules={rules} onChange={setRules} />
          </div>
        </form>

        <PortalChips query={{ brand, model, year }} />

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
              {num.format(report.sample)} avisos · {report.scope}
            </p>
            {report.insight ? (
              <p className="mt-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                {report.insight}
              </p>
            ) : null}
            {report.sample < 8 ? (
              <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                Muestra chica ({report.sample} avisos): toma la banda de precio con reserva.
              </p>
            ) : null}
          </div>

          <ValuationPanel valuation={liveValuation} generation={generation || report.generation} />

          {report.recommendations?.length ? (
            <section>
              <h3 className="mb-3 text-sm font-semibold">Recomendación de compra</h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {report.recommendations.slice(0, 2).map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => onOpen(row)}
                    className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-left hover:border-emerald-400/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-emerald-300">Mejor trato vs su año</div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {row.year} {row.brand} {row.model}
                        </div>
                        <p className="mt-1 text-xs text-slate-300">{row.reason || (row.reasons || []).join(" · ")}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xl font-semibold text-emerald-300">{clp.format(row.price)}</div>
                        {row.delta_pct != null ? (
                          <div className="text-xs text-emerald-200">{row.delta_pct}% vs mediana</div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label={`Más barato ${report.peer_year ? report.peer_year : ""}`}
              value={report.stats?.min ? clp.format(report.stats.min) : "—"}
              hint={report.cheapest ? `${report.peer_n || report.sample} pares del mismo año · ${report.cheapest.city || report.cheapest.region || "Chile"}` : ""}
            />
            <Stat
              label="Retoma / compra"
              value={liveValuation?.buy ? clp.format(liveValuation.buy) : report.suggested_buy ? clp.format(report.suggested_buy) : "—"}
              hint="Techo para comprar, no el ask publicado"
            />
            <Stat
              label="Publicar (retail)"
              value={liveValuation?.retail ? clp.format(liveValuation.retail) : report.stats?.p50 ? clp.format(report.stats.p50) : "—"}
              hint="Mediana de pares + km y reglas"
            />
            <Stat
              label={`Más caro ${report.peer_year ? report.peer_year : ""}`}
              value={report.stats?.max ? clp.format(report.stats.max) : "—"}
              hint={report.expensive ? `${report.peer_n || report.sample} pares del mismo año · ${report.expensive.city || report.expensive.region || "Chile"}` : ""}
            />
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <ExtremeCard
              title={report.peer_year ? `Más barato del año ${report.peer_year}` : "El más barato del mismo recorte"}
              row={report.cheapest}
              tone="text-emerald-300"
            />
            <ExtremeCard
              title={report.peer_year ? `Más caro del año ${report.peer_year}` : "El más caro del mismo recorte"}
              row={report.expensive}
              tone="text-rose-300"
            />
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            Banda de mercado (P25–P50–P75): {clp.format(report.band.low)} — {clp.format(report.band.mid)} — {clp.format(report.band.high)}
            {liveValuation?.retail ? ` · Publicar cerca de ${clp.format(liveValuation.retail)}` : report.suggested_list ? ` · Si publicas, cerca de ${clp.format(report.suggested_list)}` : ""}
            {liveValuation?.ceiling ? ` · Techo de riesgo ${clp.format(liveValuation.ceiling)}` : ""}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <div className="mb-2 font-semibold text-white">Buscar el mismo auto en otros portales</div>
            <p className="mb-3 text-xs text-slate-400">
              Kavak, Clicar y Checkeados venden usados inspeccionados. auto.cl cotiza y financia. Facebook suma particulares.
            </p>
            <PortalChips
              className=""
              hint=""
              query={{
                brand: report.query?.brand,
                model: report.query?.model,
                year: report.query?.year,
              }}
            />
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
              <h3 className="mb-3 text-sm font-semibold">Dónde está más barato y más caro (mismo año)</h3>
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
              <h3 className="mb-1 text-sm font-semibold">Oportunidades únicas</h3>
              <p className="mb-3 text-xs text-slate-400">
                Mismo modelo y año, al menos 4 pares, 12% o más bajo la mediana y kilometraje razonable.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {report.opportunities.map((row) => (
                  <div key={row.id} className="space-y-2">
                    <Card row={row} onOpen={onOpen} />
                    {row.reason ? <p className="px-1 text-[11px] text-slate-400">{row.reason}</p> : null}
                  </div>
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

      {!report && liveOpps.length ? (
        <section>
          <h3 className="mb-1 text-sm font-semibold">Oportunidades únicas ahora</h3>
          <p className="mb-3 text-xs text-slate-400">
            Calculadas al instante contra el mismo modelo y año. Escribe un auto arriba para profundizar.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {liveOpps.map((row) => (
              <div key={row.id} className="space-y-2">
                <Card row={row} onOpen={onOpen} />
                {row.reason ? <p className="px-1 text-[11px] text-slate-400">{row.reason}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!report && !catalog?.length ? (
        <div className="py-12 text-center text-slate-400">Cargando catálogo para consultar al instante…</div>
      ) : null}
    </div>
  );
}

export default memo(SearchHome);

function PortalChips({ query, className = "mt-4", hint = "Mismos filtros, otros portales." }) {
  return (
    <div className={`${className} flex flex-wrap items-center gap-2 text-xs`}>
      {portalSearchLinks(query).map((p) => (
        <a
          key={p.id}
          href={p.url}
          target="_blank"
          rel="noreferrer"
          title={p.hint}
          className={`rounded-full px-3 py-1 font-semibold hover:opacity-90 ${
            p.id === "facebook"
              ? "bg-[#1877f2] text-white"
              : "border border-white/15 bg-white/5 text-slate-200 hover:border-amber-400/40"
          }`}
        >
          {p.name}
        </a>
      ))}
      {hint ? <span className="text-slate-500">{hint}</span> : null}
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
            <span className="truncate pr-3 capitalize">{SOURCE_NAME[r.name] || r.name}</span>
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
