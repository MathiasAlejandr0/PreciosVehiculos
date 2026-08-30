import { sanitizePrice } from "../../shared/cleanListing.js";

export function pickListedPrice(text, floor = 800_000) {
  const amounts = [...String(text || "").matchAll(/\$\s*([\d.\s]+)/g)]
    .map((m) => Number(String(m[1]).replace(/[^\d]/g, "")))
    .filter((n) => Number.isFinite(n) && n >= floor);
  if (!amounts.length) return null;
  return Math.max(...amounts);
}

export function parsePrice(value, category = "auto", title = "") {
  if (value == null) return null;
  const hay = `${title || ""} ${typeof value === "string" ? value : ""}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return sanitizePrice(value, category, hay, "", null);
  }
  const raw = String(value).replace(/\s/g, "").replace(/[$\u00a0]/g, "");
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return null;
  return sanitizePrice(n, category, hay);
}

export function parseKm(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const text = Array.isArray(value) ? value.join(" ") : String(value);
  const match = text.replace(/\u00a0/g, " ").match(/([\d.\s]+)\s*km/i);
  const raw = match ? match[1] : text;
  const n = Number(String(raw).replace(/[^\d]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function parseYear(value) {
  if (value == null) return null;
  if (typeof value === "number" && value >= 1970 && value <= 2028) return value;
  const text = String(value);
  const match = text.match(/(?:^|[^\d])(19[8-9]\d|20[0-2]\d)(?:[^\d]|$)/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1970 && year <= 2028 ? year : null;
}

export function titleCase(value) {
  if (!value) return null;
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\b([a-zñáéíóúüë])([a-zñáéíóúüë]*)/g, (_, a, b) => a.toUpperCase() + b)
    .replace(/\b(Bmw|Vw|Mg|Gac|Byd|Ds|Ram)\b/g, (m) => m.toUpperCase())
    .replace(/\bMercedes Benz\b/i, "Mercedes-Benz")
    .replace(/\bLand Rover\b/i, "Land Rover")
    .replace(/\bAlfa Romeo\b/i, "Alfa Romeo")
    .replace(/\bGreat Wall\b/i, "Great Wall")
    .replace(/\bSsangyong\b/i, "SsangYong");
}

export function cleanText(value) {
  if (!value) return null;
  const t = String(value).replace(/\s+/g, " ").trim();
  return t || null;
}
