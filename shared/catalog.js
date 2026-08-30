/** Catálogo canónico inferido de los avisos: marca → modelo → generación → versiones. */

function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitGenerations(years) {
  const uniq = [...new Set(years.filter(Boolean))].sort((a, b) => a - b);
  if (!uniq.length) return [];
  const gens = [];
  let start = uniq[0];
  let prev = uniq[0];
  for (let i = 1; i < uniq.length; i++) {
    if (uniq[i] - prev > 2) {
      gens.push({ from: start, to: prev });
      start = uniq[i];
    }
    prev = uniq[i];
  }
  gens.push({ from: start, to: prev });
  return gens;
}

function versionLabel(row) {
  const bits = [row.version, row.fuel, row.transmission].filter(Boolean);
  const label = bits.join(" · ").replace(/\s+/g, " ").trim();
  return label.slice(0, 80) || null;
}

export function buildVehicleCatalog(rows) {
  const tree = new Map();
  for (const row of rows || []) {
    if (!row.brand || !row.model) continue;
    const bk = fold(row.brand);
    const mk = fold(row.model);
    if (!tree.has(bk)) tree.set(bk, { brand: row.brand, models: new Map() });
    const brand = tree.get(bk);
    if (!brand.models.has(mk)) {
      brand.models.set(mk, { model: row.model, years: [], versions: new Map(), n: 0 });
    }
    const model = brand.models.get(mk);
    model.n += 1;
    if (row.year) model.years.push(row.year);
    const v = versionLabel(row);
    if (v) model.versions.set(v, (model.versions.get(v) || 0) + 1);
  }

  const brands = [...tree.values()]
    .map((b) => ({
      brand: b.brand,
      n: [...b.models.values()].reduce((a, m) => a + m.n, 0),
      models: [...b.models.values()]
        .map((m) => {
          const gens = splitGenerations(m.years);
          return {
            model: m.model,
            n: m.n,
            year_min: m.years.length ? Math.min(...m.years) : null,
            year_max: m.years.length ? Math.max(...m.years) : null,
            generations: gens,
            versions: [...m.versions.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 12)
              .map(([value, n]) => ({ value, n })),
          };
        })
        .sort((a, b) => b.n - a.n),
    }))
    .sort((a, b) => b.n - a.n);

  return { brands: brands.slice(0, 80), generatedAt: new Date().toISOString() };
}

export function generationsFor(catalog, brand, model) {
  const b = (catalog?.brands || []).find((x) => fold(x.brand) === fold(brand));
  const m = b?.models?.find((x) => fold(x.model) === fold(model));
  return m || null;
}
