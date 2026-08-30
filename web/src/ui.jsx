export const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export const num = new Intl.NumberFormat("es-CL");

export const SOURCE_NAME = {
  facebook: "Facebook",
  mercadolibre: "Mercado Libre",
  chileautos: "Chileautos",
  yapo: "Yapo",
  autocosmos: "Autocosmos",
  kavak: "Kavak",
  clicar: "Clicar",
  checkeados: "Checkeados",
  autocl: "auto.cl",
};

export const TONE = {
  emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  lime: "bg-lime-500/15 text-lime-300 ring-lime-500/30",
  sky: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  rose: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  zinc: "bg-white/10 text-slate-300 ring-white/10",
};

export function Badge({ deal }) {
  if (!deal) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${TONE[deal.tone] || TONE.zinc}`}>
      {deal.label}
    </span>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function Card({ row, onOpen }) {
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
          {SOURCE_NAME[row.source] || row.source}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="text-sm font-semibold text-white line-clamp-2">
          {row.brand} {row.model} {row.year || ""}
        </div>
        <div className="text-xs text-slate-400 line-clamp-1">{row.version || row.title}</div>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <div className="font-mono text-lg font-semibold text-amber-300">{row.price ? clp.format(row.price) : "—"}</div>
            {row.delta_pct != null ? (
              <div className={`text-[11px] ${row.delta_pct <= -4 ? "text-emerald-300" : row.delta_pct >= 8 ? "text-rose-300" : "text-slate-500"}`}>
                {row.delta_pct > 0 ? "+" : ""}{row.delta_pct}% vs {row.year || "su año"}
              </div>
            ) : null}
          </div>
          <div className="text-right text-[11px] text-slate-400">
            {row.mileage != null ? `${num.format(row.mileage)} km` : "km n/d"}
            <div>{row.city || row.region || "Chile"}</div>
          </div>
        </div>
      </div>
    </button>
  );
}

export function ChartTip({ active, payload, label, money }) {
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

export function Select({ label, value, onChange, options, placeholder = "Todas", allowEmpty = true }) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <select
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={`${o.brand || ""}-${o.value}`} value={o.value}>
            {o.label || o.value} {o.n != null ? `(${o.n})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
