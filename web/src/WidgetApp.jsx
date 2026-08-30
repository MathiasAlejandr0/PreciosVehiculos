import { useEffect, useMemo, useState } from "react";
import { sanitizeListing, facetsFromRows } from "../../shared/cleanListing.js";
import { parseLocation } from "../../server/lib/geo.js";
import { valueVehicle } from "../../shared/valuation.js";
import { Field, Select } from "./ui.jsx";
import ValuationPanel, { RuleToggles } from "./ValuationPanel.jsx";

export default function WidgetApp() {
  const [catalog, setCatalog] = useState([]);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [version, setVersion] = useState("");
  const [fuel, setFuel] = useState("");
  const [transmission, setTransmission] = useState("");
  const [rules, setRules] = useState({});

  useEffect(() => {
    fetch("/data/listings.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setCatalog((d.rows || []).map((row) => sanitizeListing(row, parseLocation)).filter(Boolean)))
      .catch(() => setCatalog([]));
  }, []);

  const facets = useMemo(() => facetsFromRows(catalog), [catalog]);
  const models = useMemo(
    () => (facets.models || []).filter((m) => !brand || m.brand === brand),
    [facets.models, brand]
  );
  const versions = useMemo(
    () =>
      (facets.versions || [])
        .filter((v) => (!brand || v.brand === brand) && (!model || v.model === model))
        .slice(0, 30),
    [facets.versions, brand, model]
  );

  const valuation = useMemo(() => {
    if (!catalog.length || !brand) return null;
    return valueVehicle(catalog, {
      brand,
      model,
      year,
      mileage,
      version,
      fuel,
      transmission,
      rules,
      kind: "livianos",
    });
  }, [catalog, brand, model, year, mileage, version, fuel, transmission, rules]);

  return (
    <div className="bg-[#08111c] p-4 text-slate-100">
      <div className="mx-auto max-w-xl space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Widget de tasación</p>
          <h1 className="mt-1 text-xl font-semibold">
            Precio<span className="text-amber-400">Auto</span>
          </h1>
          <p className="text-xs text-slate-400">Tres precios sobre avisos públicos de Chile. Ask ≠ transferencia.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Marca" value={brand} onChange={(v) => { setBrand(v); setModel(""); }} options={facets.brands || []} />
          <Select label="Modelo" value={model} onChange={setModel} options={models} />
          <Field label="Año" value={year} onChange={setYear} placeholder="2018" />
          <Field label="Kilómetros" value={mileage} onChange={setMileage} placeholder="80000" />
          <Select label="Versión" value={version} onChange={setVersion} options={versions} placeholder="Cualquiera" />
          <Select label="Combustible" value={fuel} onChange={setFuel} options={facets.fuels || []} placeholder="Cualquiera" />
          <Select label="Cambio" value={transmission} onChange={setTransmission} options={facets.transmissions || []} placeholder="Cualquiera" />
        </div>
        <RuleToggles rules={rules} onChange={setRules} />
        {valuation?.retail ? (
          <ValuationPanel valuation={valuation} />
        ) : brand ? (
          <p className="text-sm text-slate-400">Faltan pares para tasar esa combinación.</p>
        ) : (
          <p className="text-sm text-slate-400">Elige marca y modelo para tasar.</p>
        )}
        {valuation?.retail ? (
          <p className="text-[11px] text-slate-500">
            {import.meta.env.PROD
              ? "Tasación sobre el snapshot público. En este deploy no hay API."
              : "En local puedes POST /api/tasar. Embed: ?embed=1"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
