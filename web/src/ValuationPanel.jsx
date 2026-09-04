import { Badge, Stat, clp, num } from "./ui.jsx";

const TONE = {
  alta: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  media: "bg-amber-400/15 text-amber-200 ring-amber-400/30",
  baja: "bg-rose-500/15 text-rose-200 ring-rose-500/30",
};

export default function ValuationPanel({ valuation, generation, compact }) {
  if (!valuation?.retail) {
    if (!valuation?.message) return null;
    return (
      <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-100">
        {valuation.message}
      </section>
    );
  }
  const c = valuation.confidence || {};
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Tasación (tres precios)</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${TONE[c.level] || TONE.baja}`}>
          Confianza {c.level || "baja"} · {c.score ?? 0}/100
        </span>
      </div>
      <p className="text-xs text-slate-400">
        {valuation.scope}
        {generation?.generations?.length
          ? ` · generación ${generation.generations.map((g) => `${g.from}–${g.to}`).join(", ")}`
          : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Retoma / si compras" value={clp.format(valuation.buy)} hint="Lo que conviene pagar" />
        <Stat label="Precio de mercado" value={clp.format(valuation.retail)} hint="Mediana de ese mismo auto" />
        <Stat label="Techo" value={clp.format(valuation.ceiling)} hint="No pases de este valor" />
      </div>
      {compact ? (
        <p className="text-xs text-slate-500">
          {c.notes?.join(" · ")}
          {valuation.close_est ? ` · Cierre estimado ${clp.format(valuation.close_est)}` : ""}
        </p>
      ) : (
      <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
          <div className="text-xs uppercase tracking-wide text-slate-400">Cierre estimado</div>
          <div className="mt-1 font-mono text-xl text-white">{clp.format(valuation.close_est)}</div>
          <p className="mt-1 text-xs text-slate-500">~6% bajo publicar. Es un factor empírico, no una transferencia real.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
          <div className="text-xs uppercase tracking-wide text-slate-400">Ajuste por km</div>
          <div className="mt-1 font-mono text-xl text-white">
            {valuation.km?.adjust ? `${valuation.km.adjust > 0 ? "+" : ""}${clp.format(valuation.km.adjust)}` : "Sin ajuste"}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {valuation.km?.input
              ? `${num.format(valuation.km.input)} km vs mediana de pares ${valuation.km.median_peer ? num.format(Math.round(valuation.km.median_peer)) : "n/d"} km (${valuation.km.slope_per_km || 0} $/km)`
              : "Indica kilometraje para ajustar la mediana"}
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-100">
        {valuation.disclaimer}
        {valuation.liquidity?.note ? ` · ${valuation.liquidity.note}` : ""}
        {c.notes?.length ? ` · ${c.notes.join(" · ")}` : ""}
        {valuation.rules_applied?.length ? ` · Reglas: ${valuation.rules_applied.join(", ")}` : ""}
      </div>
      </>
      )}
    </section>
  );
}

export function RuleToggles({ rules, onChange }) {
  const items = [
    ["unico_dueno", "Único dueño"],
    ["choque", "Choque / reparación"],
    ["automatico", "Automático"],
    ["manual", "Manual"],
    ["region_rm", "Está en la RM"],
    ["region_otra", "Está en otra región"],
  ];
  function toggle(key) {
    const next = { ...rules, [key]: !rules[key] };
    if (key === "automatico" && next.automatico) next.manual = false;
    if (key === "manual" && next.manual) next.automatico = false;
    if (key === "region_rm" && next.region_rm) next.region_otra = false;
    if (key === "region_otra" && next.region_otra) next.region_rm = false;
    onChange(next);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => toggle(key)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            rules[key] ? "bg-amber-400 text-black" : "border border-white/15 text-slate-300"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
