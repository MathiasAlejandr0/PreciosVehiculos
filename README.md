# PrecioAuto — mercado de usados Chile

Suite de inteligencia de precios para vehículos de segunda mano. Agrega avisos públicos de los portales más grandes del país, calcula mínimo / mediana / máximo por región y ciudad, y publica un panel listo para [Vercel](https://vercel.com).

Repo: [MathiasAlejandr0/PreciosVehiculos](https://github.com/MathiasAlejandr0/PreciosVehiculos).

## Portales (prioridad de volumen)

| Prioridad | Portal | Cobertura |
|---|---|---|
| 1 | [Chileautos](https://www.chileautos.cl) | ~60.000 avisos, 16 regiones |
| 2 | [Yapo](https://www.yapo.cl/autos-usados) | ~34.000, ciudades |
| 3 | [Mercado Libre](https://autos.mercadolibre.cl/autos-usados) | nacional + regiones |
| 4 | [Autocosmos](https://www.autocosmos.cl/usados) | clasificados por marca |
| 5 | [Clicar](https://www.clicar.cl) | red de automotoras |
| 6 | [Kavak](https://www.kavak.com/cl/usados) | Santiago |
| 7 | [Autosusados.cl](https://autosusados.cl) | agregador |

El barrido recorre Chileautos por tipo (autos, motos, camiones) **y por región**, Yapo por ciudades, y Mercado Libre por regiones, para no quedarse solo en Santiago.

## Local

```bash
npm install
npm run dev
```

- Panel: http://localhost:5173
- API: http://localhost:8787

Barridos:

```bash
npm run crawl quick
npm run crawl standard
npm run snapshot
```

`snapshot` escribe `web/public/data/stats.json` y `listings.json`. Eso es lo que Vercel sirve por CDN (carga inmediata, sin scraping en el edge).

## Vercel

1. Importa este repo en Vercel (framework: Other, output `web/dist`).
2. Build: `npm run build` (ya está en `vercel.json`).
3. Para refrescar precios: corre `npm run crawl standard` en local, `npm run snapshot`, commit y push de `web/public/data/`.

El crawler no corre dentro de Vercel (timeouts y anti-bot). El dashboard en producción lee JSON estático cacheado.

## Qué muestra el panel

La **portada es un buscador**: escribes marca, modelo y año (ej. `Toyota Yaris 2018`) y ves el informe de ese vehículo.

- Precio más barato y más caro, con ciudad/región
- Banda de mercado (P25 / mediana / P75) y precio sugerido para comprar o publicar
- Evolución por año modelo, por kilometraje y por región
- Avisos reales ordenados de menor a mayor
- Mercado general, territorio y listado completo en las otras pestañas
