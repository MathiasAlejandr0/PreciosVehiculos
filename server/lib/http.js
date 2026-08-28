const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

export async function fetchText(url, { ua = "desktop", accept = "*/*", headers = {}, timeoutMs = 25000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua === "mobile" ? MOBILE_UA : DESKTOP_UA,
        Accept: accept,
        "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        ...headers,
      },
      redirect: "follow",
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, url: res.url, text, contentType: res.headers.get("content-type") || "" };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, opts = {}) {
  const res = await fetchText(url, { accept: "application/json,text/plain,*/*", ...opts });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${url}`);
    err.status = res.status;
    err.body = res.text.slice(0, 300);
    throw err;
  }
  try {
    return JSON.parse(res.text);
  } catch {
    const err = new Error(`JSON inválido en ${url}`);
    err.body = res.text.slice(0, 300);
    throw err;
  }
}

export async function withRetry(fn, { tries = 3, delayMs = 800 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const status = err.status || 0;
      if (status === 404) throw err;
      await sleep(delayMs * (i + 1) + Math.floor(Math.random() * 250));
    }
  }
  throw last;
}
