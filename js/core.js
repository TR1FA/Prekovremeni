// Prekovremeni — logika bez UI-ja: datumi, periodi, sati, statistika, spajanje, sifrovanje, GitHub.

export const REPO = 'TR1FA/Prekovremeni';
export const BRANCH = 'main';
export const KDF_ITER = 600000;

export const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'Avgust',
  'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
// indeks = Date.getDay()
export const DAYS = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
export const DAYS_SHORT = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];

// ---------- datumi ----------
export const pad = (n) => String(n).padStart(2, '0');
export function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function todayISO() { return toISO(new Date()); }
export function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function dayIndex(iso) { return parseISO(iso).getDay(); }
export function dayName(iso) { return DAYS[dayIndex(iso)]; }
export function isWeekend(iso) { const i = dayIndex(iso); return i === 0 || i === 6; }
export function fmtDate(iso) { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}.`; }
export function fmtDateShort(iso) { const [, m, d] = iso.split('-'); return `${d}.${m}.`; }

// ---------- periodi (obracunski mjesec, npr. "2026-11") ----------
export function periodLabel(id) { const [y, m] = id.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; }
export function periodShort(id) { const [y, m] = id.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 3)} ${String(y).slice(2)}`; }
export function nextPeriodId(id) { let [y, m] = id.split('-').map(Number); m++; if (m > 12) { m = 1; y++; } return `${y}-${pad(m)}`; }
export function periodYear(id) { return Number(id.slice(0, 4)); }

// ---------- sati ----------
// "2", "1,5", "1.5", "3+4", "1:30", "2h" -> { hours, expr }
export function parseHours(input) {
  let s = String(input ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/h$/, '').replace(/,/g, '.');
  if (!s) return null;
  const parts = s.split('+');
  let total = 0;
  for (const p of parts) {
    let m;
    if (!p) return null;
    if ((m = p.match(/^(\d{1,2}):(\d{2})$/))) {
      if (+m[2] >= 60) return null;
      total += +m[1] + +m[2] / 60;
    } else if (/^(\d+(\.\d*)?|\.\d+)$/.test(p)) {
      total += parseFloat(p);
    } else return null;
  }
  total = Math.round(total * 100) / 100;
  if (!(total > 0) || total > 24) return null;
  return { hours: total, expr: parts.length > 1 ? parts.join('+') : null };
}
export function fmtHours(h) {
  if (h == null || isNaN(h)) return '';
  const r = Math.round(h * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',');
}
export function fmtH(h) { return `${fmtHours(h)} h`; }

// ---------- dokument ----------
export function uid() {
  const a = crypto.getRandomValues(new Uint8Array(6));
  return 'e' + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
export const live = (doc) => doc.entries.filter((e) => !e.del);
export function entriesOf(doc, pid) {
  return live(doc).filter((e) => e.period === pid)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.c || 0) - (b.c || 0));
}
export function sortedPeriods(doc) { return [...doc.periods].sort((a, b) => a.id.localeCompare(b.id)); }
export function getPeriod(doc, pid) { return doc.periods.find((p) => p.id === pid); }
export function latestOpenPeriod(doc) {
  const ps = sortedPeriods(doc);
  const open = ps.filter((p) => p.status === 'open');
  return (open.at(-1) || ps.at(-1))?.id || `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
}
export function ensurePeriod(doc, pid, now = Date.now()) {
  let p = getPeriod(doc, pid);
  if (!p) { p = { id: pid, status: 'open', closedAt: null, u: now }; doc.periods.push(p); }
  return p;
}

// ---------- statistika ----------
export function periodStats(list) {
  const hours = list.map((e) => e.hours || 0);
  const total = hours.reduce((a, b) => a + b, 0);
  const days = new Set(list.map((e) => e.date)).size;
  const weekend = list.filter((e) => isWeekend(e.date)).reduce((a, e) => a + (e.hours || 0), 0);
  return {
    total: round2(total), count: list.length, days,
    avg: list.length ? round2(total / list.length) : 0,
    max: list.length ? Math.max(...hours) : 0,
    weekend: round2(weekend),
  };
}
const round2 = (x) => Math.round(x * 100) / 100;

const STOP = new Set(['za', 'na', 'sa', 'iz', 'od', 'do', 'po', 'pri', 'kod', 'kući', 'kuci', 'i', 'u', 'a',
  'ili', 'te', 'the', 'and', 'of', 'nazad', 'sve', 'oko', 'pa', 'ali', 'se', 'rad', 'rada']);
// kljucne rijeci iz opisa -> zbir sati (svaka rijec se broji jednom po unosu)
export function keywordHours(list, top = 8) {
  const acc = new Map();
  for (const e of list) {
    const words = new Set();
    for (const raw of e.desc.split(/[\s,.;:()/+&–—-]+/)) {
      const w = raw.trim();
      if (!w || w.length < 3 && !/\d/.test(w)) continue;
      const k = w.toLocaleLowerCase('sr');
      if (STOP.has(k) || /^\d+$/.test(k)) continue;
      words.add(k + '\u0000' + w);
    }
    const seen = new Set();
    for (const kw of words) {
      const [k, w] = kw.split('\u0000');
      if (seen.has(k)) continue;
      seen.add(k);
      const cur = acc.get(k) || { hours: 0, count: 0, forms: new Map() };
      cur.hours += e.hours || 0; cur.count++;
      cur.forms.set(w, (cur.forms.get(w) || 0) + 1);
      acc.set(k, cur);
    }
  }
  return [...acc.values()].map((v) => {
    let best = '', n = -1;
    for (const [w, c] of v.forms) if (c > n || (c === n && w[0] === w[0].toUpperCase())) { best = w; n = c; }
    return { word: best[0].toLocaleUpperCase('sr') + best.slice(1), hours: round2(v.hours), count: v.count };
  }).sort((a, b) => b.hours - a.hours || b.count - a.count).slice(0, top);
}

export function weekdayHours(list) {
  const out = [0, 0, 0, 0, 0, 0, 0]; // Pon..Ned
  for (const e of list) out[(dayIndex(e.date) + 6) % 7] += e.hours || 0;
  return out.map(round2);
}

// prijedlozi opisa: najcesci u zadnjih 90 dana, pa ostali
export function descSuggestions(doc, limit = 6) {
  const cutoff = toISO(new Date(Date.now() - 90 * 864e5));
  const acc = new Map();
  for (const e of live(doc)) {
    const k = e.desc.trim();
    if (!k) continue;
    const cur = acc.get(k) || { desc: k, n: 0, recent: 0, last: '' };
    cur.n++; if (e.date >= cutoff) cur.recent++;
    if (e.date > cur.last) cur.last = e.date;
    acc.set(k, cur);
  }
  const all = [...acc.values()].sort((a, b) => b.recent - a.recent || b.n - a.n || b.last.localeCompare(a.last));
  return { top: all.slice(0, limit).map((x) => x.desc), all: all.map((x) => x.desc) };
}

// ---------- spajanje (dva uredjaja) ----------
function mergeList(a = [], b = []) {
  const m = new Map();
  for (const x of a) m.set(x.id, x);
  for (const y of b) { const x = m.get(y.id); if (!x || (y.u || 0) > (x.u || 0)) m.set(y.id, y); }
  return [...m.values()];
}
export function mergeDocs(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  return {
    v: 1,
    profile: (local.profile?.u || 0) > (remote.profile?.u || 0) ? local.profile : remote.profile,
    periods: mergeList(remote.periods, local.periods).sort((x, y) => x.id.localeCompare(y.id)),
    entries: mergeList(remote.entries, local.entries).sort((x, y) => x.id.localeCompare(y.id)),
    saved: Math.max(local.saved || 0, remote.saved || 0),
  };
}
export function canonical(doc) {
  if (!doc) return '';
  const byId = (x, y) => x.id.localeCompare(y.id);
  return JSON.stringify([doc.profile, [...doc.periods].sort(byId), [...doc.entries].sort(byId)]);
}

// ---------- sifrovanje (PBKDF2-SHA256 -> AES-256-GCM, isto kao tools/pk.py) ----------
const te = new TextEncoder(), td = new TextDecoder();
export function b64(buf) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
export function newSalt() { return b64(crypto.getRandomValues(new Uint8Array(16))); }

export async function deriveKey(password, saltB64, iter = KDF_ITER, extractable = false) {
  const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(saltB64), iterations: iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']);
}
export async function exportKey(key) { return b64(await crypto.subtle.exportKey('raw', key)); }
export async function importKey(rawB64) {
  return crypto.subtle.importKey('raw', unb64(rawB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
export async function encryptText(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(text));
  return { iv: b64(iv), ct: b64(ct) };
}
export async function decryptText(box, key) {
  return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct)));
}
export async function encryptDoc(doc, key, salt, iter = KDF_ITER) {
  const box = await encryptText(JSON.stringify(doc), key);
  return { v: 1, kdf: 'PBKDF2-SHA256', iter, salt, iv: box.iv, ct: box.ct };
}
export async function decryptDoc(blob, key) { return JSON.parse(await decryptText(blob, key)); }

// ---------- GitHub (Contents API) ----------
export class GhError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}
function ghHeaders(token) {
  const h = { Accept: 'application/vnd.github+json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}
export async function ghGet(path, token) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}&t=${Date.now()}`,
    { headers: ghHeaders(token), cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new GhError(r.status, await ghMsg(r));
  const j = await r.json();
  return { sha: j.sha, text: atob(j.content.replace(/\n/g, '')) };
}
export async function ghPut(path, text, sha, message, token) {
  const body = { message, content: btoa(text), branch: BRANCH };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new GhError(r.status, await ghMsg(r));
  const j = await r.json();
  return j.content.sha;
}
export async function ghCheckToken(token) {
  const r = await fetch(`https://api.github.com/repos/${REPO}`, { headers: ghHeaders(token), cache: 'no-store' });
  if (!r.ok) throw new GhError(r.status, await ghMsg(r));
  return r.json(); // pravo upisa se provjerava stvarnim upisom (sync s force)
}
async function ghMsg(r) {
  try { const j = await r.json(); return j.message || r.statusText; } catch { return r.statusText; }
}
