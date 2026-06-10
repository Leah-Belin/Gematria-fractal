// localStorage cache for gematria analysis results — 24 h TTL, 50 entry cap

const PREFIX = 'gematria_v1_';
const TTL = 86_400_000; // 24 h
const MAX = 50;

function makeKey(text, depth) {
  // djb2 hash over text to keep localStorage keys safe and short
  let h = 5381;
  const s = `${text.trim()}|${depth}`;
  for (let i = 0; i < s.length; i++) h = Math.imul((h << 5) + h, 1) ^ s.charCodeAt(i);
  return `${PREFIX}${(h >>> 0).toString(36)}`;
}

export function cacheGet(text, depth) {
  try {
    const raw = localStorage.getItem(makeKey(text, depth));
    if (!raw) return null;
    const { data, exp } = JSON.parse(raw);
    if (Date.now() > exp) { localStorage.removeItem(makeKey(text, depth)); return null; }
    return data;
  } catch {
    return null;
  }
}

export function cacheSet(text, depth, data) {
  try {
    localStorage.setItem(
      makeKey(text, depth),
      JSON.stringify({ data, exp: Date.now() + TTL, text: text.trim().slice(0, 60) })
    );
    pruneCache();
  } catch {
    // storage full or unavailable — fail silently
  }
}

function pruneCache() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
  if (keys.length <= MAX) return;
  const entries = keys.map(k => {
    try { return { k, exp: JSON.parse(localStorage.getItem(k)).exp }; }
    catch { return { k, exp: 0 }; }
  });
  entries.sort((a, b) => a.exp - b.exp)
         .slice(0, entries.length - MAX)
         .forEach(e => localStorage.removeItem(e.k));
}
