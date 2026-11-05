// Prekovremeni — korisnicki interfejs
import * as C from './core.js';
import { buildWorkbook } from './excel.js';

const VERSION = '1.0';
const ON_PAGES = location.hostname.endsWith('github.io');
const SESSION_DAYS = 30;
const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new?name=Prekovremeni&description=Upis+prekovremenih+sati&target_name=TR1FA&expires_in=none&contents=write';

// ---------- sitnice ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = (kind) => ({
  get(k) { try { return window[kind].getItem(k); } catch { return null; } },
  set(k, v) { try { window[kind].setItem(k, v); } catch { /* privatni prozor */ } },
  del(k) { try { window[kind].removeItem(k); } catch { /* */ } },
  json(k) { try { return JSON.parse(window[kind].getItem(k)); } catch { return null; } },
});
const LS = store('localStorage'), SS = store('sessionStorage');
const hhmm = (t) => { const d = new Date(t); return `${C.pad(d.getHours())}:${C.pad(d.getMinutes())}`; };

const I = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  down: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  up: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><path d="M8 14h8v7H8z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.7"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
};
const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

// ---------- stanje ----------
const S = {
  users: [], uid: null, user: null, key: null, salt: null, iter: null, doc: null, token: null,
  ver: 0, meta: { dirty: false, lastSync: 0 }, view: 'unos', period: null, year: null, editId: null, flashId: null,
  pwMismatch: false, remember: false,
  sync: { state: 'idle', err: '', running: null, again: false, timer: null },
  saveChain: Promise.resolve(),
};
const dataPath = (uid) => `data/${uid}.enc.json`;

// ---------- tema ----------
function themePref() { return LS.get('pk_theme') || 'auto'; }
function effectiveDark() {
  const t = themePref();
  return t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
}
function applyTheme() {
  const t = themePref();
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const dark = effectiveDark();
  $('meta[name="theme-color"]').content = '#1F3864';
  const b = $('#themeBtn');
  if (b) { b.innerHTML = icon(dark ? 'sun' : 'moon'); b.title = dark ? 'Svijetla tema' : 'Tamna tema'; }
}
function setTheme(t) { LS.set('pk_theme', t); applyTheme(); }

// ---------- toast ----------
let toastTimer;
function toast(msg, { err = false, action = null, ms = 3200 } = {}) {
  const t = $('#toast');
  t.className = 'toast show' + (err ? ' err' : '');
  t.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = () => { hideToast(); action.fn(); };
    t.append(b);
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 6000 : ms);
}
function hideToast() { $('#toast').classList.remove('show'); }

// ---------- lokalno cuvanje (sifrovano) ----------
function readLocalBlob(uid) { return LS.json(`pk_doc_${uid}`); }
function saveLocal() {
  const { uid, key, salt, iter } = S;
  const doc = S.doc;
  S.saveChain = S.saveChain.then(async () => {
    if (!key || uid !== S.uid) return;
    const blob = await C.encryptDoc(doc, key, salt, iter);
    LS.set(`pk_doc_${uid}`, JSON.stringify(blob));
    LS.set(`pk_meta_${uid}`, JSON.stringify(S.meta));
  }).catch((e) => console.error('saveLocal', e));
  return S.saveChain;
}
async function saveToken(token) {
  if (!token) { LS.del(`pk_tok_${S.uid}`); return; }
  const box = await C.encryptText(token, S.key);
  LS.set(`pk_tok_${S.uid}`, JSON.stringify({ salt: S.salt, ...box }));
}
async function loadToken() {
  const t = LS.json(`pk_tok_${S.uid}`);
  if (!t || t.salt !== S.salt) return null;
  try { return await C.decryptText(t, S.key); } catch { return null; }
}

// ---------- server (GitHub) ----------
async function fetchRemote(uid, token) {
  const path = dataPath(uid);
  if (ON_PAGES) {
    try {
      const r = await C.ghGet(path, token);
      return r ? { blob: JSON.parse(r.text), sha: r.sha } : null;
    } catch (e) {
      if (token) throw e; // bez tokena: probaj obicni fajl sa stranice
    }
  }
  const r = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Server je vratio ${r.status}`);
  return { blob: await r.json(), sha: null };
}

async function loadUsers() {
  try {
    const r = await fetch(`data/users.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    LS.set('pk_users', JSON.stringify(j.users));
    return j.users;
  } catch {
    return LS.json('pk_users') || [];
  }
}

// ---------- prijava ----------
function showLogin(msg = '') {
  $('#shell').hidden = true;
  $('#login').hidden = false;
  const sel = $('#loginUser');
  const last = LS.get('pk_last_user');
  sel.innerHTML = S.users.length
    ? S.users.map((u) => `<option value="${esc(u.id)}" ${u.id === last ? 'selected' : ''}>${esc(u.name)}</option>`).join('')
    : '<option value="">— nema korisnika —</option>';
  $('#loginErr').textContent = msg;
  $('#loginVer').textContent = `Prekovremeni ${VERSION}`;
  $('#pwEye').innerHTML = icon('eye');
  setTimeout(() => $('#loginPw').focus(), 50);
}

async function authenticate(uid, password) {
  const local = readLocalBlob(uid);
  let remote = null, netErr = null;
  try { remote = await fetchRemote(uid); } catch (e) { netErr = e; }
  if (!remote && !local) {
    throw new Error(netErr ? 'Nema interneta, a na ovom uređaju još nema podataka.' : 'Za ovog korisnika nema podataka.');
  }
  const keys = new Map();
  const keyFor = async (b) => {
    const id = `${b.salt}:${b.iter}`;
    if (!keys.has(id)) keys.set(id, await C.deriveKey(password, b.salt, b.iter, true));
    return keys.get(id);
  };
  let rdoc = null, rkey = null, ldoc = null, lkey = null;
  if (remote) { try { rkey = await keyFor(remote.blob); rdoc = await C.decryptDoc(remote.blob, rkey); } catch { rdoc = null; } }
  if (local) { try { lkey = await keyFor(local); ldoc = await C.decryptDoc(local, lkey); } catch { ldoc = null; } }
  if (!rdoc && !ldoc) throw new Error('Pogrešna šifra.');
  if (rdoc) {
    const doc = ldoc ? C.mergeDocs(ldoc, rdoc) : rdoc;
    return { key: rkey, salt: remote.blob.salt, iter: remote.blob.iter, doc, dirty: C.canonical(doc) !== C.canonical(rdoc), mismatch: false };
  }
  return { key: lkey, salt: local.salt, iter: local.iter, doc: ldoc, dirty: true, mismatch: !!remote };
}

async function onLogin(ev) {
  ev.preventDefault();
  const uid = $('#loginUser').value, pw = $('#loginPw').value, remember = $('#loginRemember').checked;
  if (!uid || !pw) return;
  const btn = $('#loginBtn');
  btn.disabled = true; btn.textContent = 'Provjeravam…'; $('#loginErr').textContent = '';
  try {
    const res = await authenticate(uid, pw);
    const sess = { uid, k: await C.exportKey(res.key), salt: res.salt, iter: res.iter, exp: Date.now() + SESSION_DAYS * 864e5 };
    LS.del('pk_sess'); SS.del('pk_sess');
    (remember ? LS : SS).set('pk_sess', JSON.stringify(sess));
    S.remember = remember;
    $('#loginPw').value = '';
    await enter(uid, res.key, res.salt, res.iter, res.doc, { dirty: res.dirty, mismatch: res.mismatch });
  } catch (e) {
    $('#loginErr').textContent = e.message || 'Prijava nije uspjela.';
    $('#loginPw').select();
  } finally {
    btn.disabled = false; btn.textContent = 'Prijava';
  }
}

async function resume() {
  const sess = LS.json('pk_sess') || SS.json('pk_sess');
  if (!sess || !(sess.exp > Date.now()) || !S.users.some((u) => u.id === sess.uid)) return false;
  try {
    const key = await C.importKey(sess.k);
    let doc = null;
    const local = readLocalBlob(sess.uid);
    if (local && local.salt === sess.salt) doc = await C.decryptDoc(local, key);
    else {
      const remote = await fetchRemote(sess.uid);
      if (!remote || remote.blob.salt !== sess.salt) throw new Error('stara sesija');
      doc = await C.decryptDoc(remote.blob, key);
    }
    S.remember = !!LS.json('pk_sess');
    await enter(sess.uid, key, sess.salt, sess.iter, doc, {});
    return true;
  } catch (e) {
    console.warn('resume', e);
    LS.del('pk_sess'); SS.del('pk_sess');
    return false;
  }
}

function normalize(doc) {
  doc.v = 1;
  doc.profile ||= {};
  doc.profile.unit ||= 'INVENDA SYSTEMS  •  PROIZVODNJA';
  doc.periods ||= [];
  doc.entries ||= [];
  if (!doc.periods.length) C.ensurePeriod(doc, `${new Date().getFullYear()}-${C.pad(new Date().getMonth() + 1)}`);
  return doc;
}

async function enter(uid, key, salt, iter, doc, { dirty = false, mismatch = false }) {
  Object.assign(S, { uid, key, salt, iter, doc: normalize(doc), user: S.users.find((u) => u.id === uid) || { id: uid, name: doc.profile?.name || uid } });
  S.meta = LS.json(`pk_meta_${uid}`) || { dirty: false, lastSync: 0 };
  if (dirty) S.meta.dirty = true;
  S.pwMismatch = mismatch;
  S.token = await loadToken();
  S.period = C.latestOpenPeriod(S.doc);
  S.year = C.periodYear(S.period);
  S.view = 'unos'; S.editId = null;
  LS.set('pk_last_user', uid);
  await saveLocal();
  $('#login').hidden = true;
  $('#shell').hidden = false;
  $('#who').textContent = S.doc.profile.name || S.user.name;
  $('#logoutBtn').innerHTML = icon('logout');
  applyTheme();
  render();
  syncNow();
}

function logout() {
  if (S.meta.dirty && S.token) syncNow();
  LS.del('pk_sess'); SS.del('pk_sess');
  Object.assign(S, { uid: null, key: null, salt: null, doc: null, token: null, editId: null });
  showLogin();
}

// ---------- sinhronizacija ----------
function setSync(state, err = '') {
  S.sync.state = state; S.sync.err = err;
  const chip = $('#syncChip');
  if (!chip) return;
  let cls = '', lbl = '', title = '';
  if (S.pwMismatch) { cls = 'error'; lbl = 'Šifra promijenjena'; title = 'Šifra je promijenjena na drugom uređaju — odjavi se i prijavi novom šifrom.'; }
  else if (state === 'busy') { cls = 'busy'; lbl = 'Sinhronizujem…'; }
  else if (state === 'error') { cls = 'error'; lbl = 'Greška'; title = err; }
  else if (!S.token) { cls = S.meta.dirty ? 'pending' : ''; lbl = 'Samo ovaj uređaj'; title = 'Unosi se čuvaju na ovom uređaju. Za čuvanje na GitHubu dodaj token u Podešavanjima.'; }
  else if (!navigator.onLine) { cls = 'pending'; lbl = 'Offline'; title = 'Nema interneta — poslaću čim se veza vrati.'; }
  else if (S.meta.dirty) { cls = 'pending'; lbl = 'Čeka slanje'; }
  else { cls = 'ok'; lbl = S.meta.lastSync ? `Sačuvano ${hhmm(S.meta.lastSync)}` : 'Sačuvano'; title = 'Sačuvano na GitHubu (šifrovano).'; }
  chip.className = `sync-chip ${cls}`;
  chip.querySelector('.lbl').textContent = lbl;
  chip.title = title || lbl;
  chip.setAttribute('aria-label', `Sinhronizacija: ${title || lbl}`);
}

function scheduleSync() {
  clearTimeout(S.sync.timer);
  setSync(S.sync.state === 'busy' ? 'busy' : 'idle');
  S.sync.timer = setTimeout(() => syncNow(), 1500);
}

function commitMessage() {
  const d = new Date();
  return `Prekovremeni: ${S.doc.profile.name || S.uid} — ${C.fmtDate(C.toISO(d))} ${hhmm(d)}`;
}

// bez tokena: samo povuci (tudje izmjene). Sa tokenom: povuci, spoji, posalji.
function syncNow({ force = false, quiet = true } = {}) {
  if (!S.key || S.pwMismatch) { setSync('idle'); return Promise.resolve(false); }
  if (S.sync.running) { S.sync.again = true; return S.sync.running; }
  if (!navigator.onLine) { setSync('idle'); return Promise.resolve(false); }
  const uid = S.uid;
  S.sync.running = (async () => {
    setSync('busy');
    try {
      for (let attempt = 0; ; attempt++) {
        const startVer = S.ver;
        const remote = await fetchRemote(uid, S.token);
        if (uid !== S.uid) return false;
        let rdoc = null;
        if (remote) {
          if (remote.blob.salt !== S.salt || remote.blob.iter !== S.iter) {
            S.pwMismatch = true;
            throw new Error('Šifra je promijenjena na drugom uređaju — odjavi se i prijavi novom šifrom.');
          }
          rdoc = await C.decryptDoc(remote.blob, S.key);
        }
        const merged = C.mergeDocs(S.doc, rdoc);
        if (S.token && (force || !rdoc || C.canonical(merged) !== C.canonical(rdoc))) {
          merged.saved = Date.now();
          const blob = await C.encryptDoc(merged, S.key, S.salt, S.iter);
          try {
            await C.ghPut(dataPath(uid), JSON.stringify(blob) + '\n', remote?.sha, commitMessage(), S.token);
          } catch (e) {
            if ((e.status === 409 || e.status === 422) && attempt < 3) continue; // neko je upisao u medjuvremenu
            throw e;
          }
        }
        const changed = C.canonical(merged) !== C.canonical(S.doc);
        S.doc = S.ver === startVer ? merged : C.mergeDocs(S.doc, merged);
        if (S.token) { S.meta.dirty = S.ver !== startVer; S.meta.lastSync = Date.now(); }
        await saveLocal();
        setSync('ok');
        if (changed) render();
        return true;
      }
    } catch (e) {
      console.warn('sync', e);
      let msg = e.message || String(e);
      if (e.status === 401) msg = 'GitHub token nije ispravan ili je istekao.';
      else if (e.status === 403 || e.status === 404) msg = `GitHub odbija upis (${e.status}): ${e.message}`;
      else if (e instanceof TypeError) msg = 'Nema veze sa GitHubom.';
      setSync('error', msg);
      if (!quiet) toast(msg, { err: true });
      if (S.view === 'postavke') render();
      return false;
    } finally {
      S.sync.running = null;
      if (S.sync.again) { S.sync.again = false; setTimeout(() => syncNow(), 300); }
    }
  })();
  return S.sync.running;
}

// ---------- izmjene ----------
function mutate(msg, opts) {
  S.ver++;
  S.meta.dirty = true;
  saveLocal();
  render();
  scheduleSync();
  if (msg) toast(msg, opts);
}
const period = (pid = S.period) => C.getPeriod(S.doc, pid);
const isOpen = (pid = S.period) => period(pid)?.status === 'open';

// ---------- render ----------
function render() {
  if (!S.doc) return;
  renderTabs();
  setSync(S.sync.state);
  const v = $('#view');
  const banner = S.pwMismatch
    ? `<div class="banner err">${icon('alert')}<div>Šifra je promijenjena na drugom uređaju. Ovdje vidiš lokalne podatke, ali se ne šalju na GitHub. <button class="link" data-act="logout">Odjavi se</button> i prijavi novom šifrom.</div></div>`
    : '';
  if (S.view === 'pregled') v.innerHTML = banner + viewPregled();
  else if (S.view === 'postavke') v.innerHTML = banner + viewPostavke();
  else { v.innerHTML = banner + viewUnos(); wireForm(); }
  if (S.flashId) {
    const row = v.querySelector(`.tr[data-id="${S.flashId}"]`);
    if (row) row.classList.add('flash');
    S.flashId = null;
  }
}

function renderTabs() {
  const tabs = [['unos', 'list', 'Unos'], ['pregled', 'chart', 'Pregled'], ['postavke', 'sliders', 'Podešavanja']];
  $('#tabs').innerHTML = tabs.map(([id, ic, lbl]) =>
    `<button class="tab" type="button" data-view="${id}" ${S.view === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${lbl}</span></button>`).join('');
}

// ---------- pogled: Unos ----------
function viewUnos() {
  const pid = S.period;
  const p = period(pid);
  const list = C.entriesOf(S.doc, pid);
  const st = C.periodStats(list);
  const ps = C.sortedPeriods(S.doc);
  const idx = ps.findIndex((x) => x.id === pid);
  const open = p?.status === 'open';
  const maxH = Math.max(1, ...list.map((e) => e.hours));

  const rows = list.map((e, i) => `
    <div class="tr ${C.isWeekend(e.date) ? 'we' : ''}" data-id="${e.id}">
      <span class="c-n">${i + 1}</span>
      <span class="c-date" data-day="${esc(C.DAYS_SHORT[C.dayIndex(e.date)])}">${C.fmtDate(e.date)}</span>
      <span class="c-day">${C.dayName(e.date)}</span>
      <span class="c-desc">${esc(e.desc)}</span>
      <span class="c-h"><i style="width:${Math.round(e.hours / maxH * 100)}%"></i><b>${e.expr ? `<abbr title="${esc(e.expr.replace(/\+/g, ' + '))}">${C.fmtH(e.hours)}</abbr>` : C.fmtH(e.hours)}</b></span>
      <span class="c-note">${esc(e.note || '')}</span>
      <span class="c-act">${open
        ? `<button class="icon-btn" data-act="edit" data-id="${e.id}" aria-label="Izmijeni" title="Izmijeni">${icon('edit')}</button><button class="icon-btn del" data-act="del" data-id="${e.id}" aria-label="Obriši" title="Obriši">${icon('trash')}</button>`
        : ''}</span>
    </div>`).join('');

  return `
  <div class="period-bar">
    <button class="icon-btn" data-act="prev" ${idx <= 0 ? 'disabled' : ''} aria-label="Prethodni period">${icon('left')}</button>
    <div class="period-title">
      <h1>${C.periodLabel(pid)}</h1>
      ${open ? `<span class="pill open">${icon('unlock')}Otvoren</span>` : `<span class="pill closed">${icon('lock')}Predat</span>`}
    </div>
    <button class="icon-btn" data-act="next" aria-label="${idx >= ps.length - 1 ? 'Novi period' : 'Sljedeći period'}" title="${idx >= ps.length - 1 ? 'Otvori novi period' : 'Sljedeći period'}">${icon(idx >= ps.length - 1 ? 'plus' : 'right')}</button>
  </div>
  <div class="unos-grid">
    <div class="unos-side">
      <section class="card hero">
        <div class="hero-total"><span class="big num">${C.fmtHours(st.total)}<small>h</small></span><span>ukupno u periodu</span></div>
        <div class="hero-stats">
          <div><b>${st.count}</b><span>unosa</span></div>
          <div><b>${st.days}</b><span>dana</span></div>
          <div><b>${C.fmtH(st.weekend)}</b><span>vikendom</span></div>
        </div>
      </section>
      ${open ? formHtml() : `
      <section class="card locked">
        <p>${icon('lock')} Period <b>${C.periodLabel(pid)}</b> je predat${p.closedAt ? ` (${C.fmtDate(C.toISO(new Date(p.closedAt)))})` : ''}. Unosi su zaključani.</p>
        <button class="btn small" data-act="reopen">${icon('unlock')}Otvori ponovo</button>
      </section>`}
    </div>
    <div class="unos-main">
      <section class="card">
        <div class="card-h"><h2>Unosi</h2><span class="muted">${st.count ? `${st.count} ${st.count === 1 ? 'unos' : st.count < 5 ? 'unosa' : 'unosa'}` : ''}</span></div>
        ${list.length ? `<div class="tbl">
          <div class="tr th"><span class="c-n">R.br.</span><span>Datum</span><span>Dan</span><span>Opis rada</span><span style="text-align:right;padding-right:6px">Sati</span><span>Napomena</span><span></span></div>
          ${rows}
        </div>
        <div class="list-foot"><span>UKUPNO SATI</span><span class="num">${C.fmtH(st.total)}</span></div>`
        : `<div class="empty">${open ? 'Još nema unosa u ovom periodu. Dodaj prvi unos.' : 'U ovom periodu nema unosa.'}</div>`}
      </section>
      <section class="card">
        <div class="card-h"><h2>Pregled perioda</h2></div>
        <div class="sum-grid">
          <div><span>Ukupno sati</span><b>${C.fmtH(st.total)}</b></div>
          <div><span>Broj unosa</span><b>${st.count}</b></div>
          <div><span>Broj dana sa unosima</span><b>${st.days}</b></div>
          <div><span>Prosječno sati po unosu</span><b>${st.count ? C.fmtH(Math.round(st.avg * 10) / 10) : '—'}</b></div>
          <div><span>Najduži pojedinačni unos</span><b>${st.count ? C.fmtH(st.max) : '—'}</b></div>
          <div><span>Sati odrađeni vikendom</span><b>${C.fmtH(st.weekend)}</b></div>
        </div>
        <div class="actions">
          <button class="btn" data-act="xls-month">${icon('down')}Excel</button>
          <button class="btn" data-act="print">${icon('print')}Štampaj / PDF</button>
          ${open ? `<button class="btn gold" data-act="close">${icon('check')}Zaključi period</button>` : ''}
        </div>
      </section>
    </div>
  </div>`;
}

function formHtml() {
  const e = S.editId ? S.doc.entries.find((x) => x.id === S.editId) : null;
  const sug = C.descSuggestions(S.doc);
  const date = e ? e.date : (S.lastDate || C.todayISO());
  const periods = C.sortedPeriods(S.doc).filter((p) => p.status === 'open' || p.id === e?.period);
  return `
  <form id="entryForm" class="card ${e ? 'editing' : ''}" autocomplete="off" novalidate>
    <div class="card-h"><h2>${e ? 'Izmjena unosa' : 'Novi unos'}</h2>${e ? '<button type="button" class="link" data-act="cancel-edit" style="margin-left:auto">Otkaži</button>' : ''}</div>
    <div class="card-b">
      <div class="form-grid">
        <label class="f">Datum <input class="in" type="date" name="date" value="${date}" required></label>
        <label class="f">Sati <input class="in num" name="hours" inputmode="decimal" enterkeyhint="next" placeholder="npr. 2 ili 3+4" value="${e ? esc(e.expr || C.fmtHours(e.hours)) : ''}" required></label>
        <label class="f wide">Opis rada <input class="in" name="desc" list="descList" enterkeyhint="next" maxlength="200" placeholder="npr. Support Simplix" value="${e ? esc(e.desc) : ''}" required></label>
        <label class="f wide">Napomena <input class="in" name="note" maxlength="200" enterkeyhint="done" placeholder="nije obavezno" value="${e ? esc(e.note || '') : ''}"></label>
        ${e && periods.length > 1 ? `<label class="f wide">Period <select class="in" name="period">${periods.map((p) => `<option value="${p.id}" ${p.id === e.period ? 'selected' : ''}>${C.periodLabel(p.id)}</option>`).join('')}</select></label>` : ''}
      </div>
      <div class="quick" aria-label="Brzi izbor sati"><span>Sati:</span>${[1, 2, 3, 4, 6, 8].map((h) => `<button type="button" class="chip h" data-hours="${h}">${h}</button>`).join('')}</div>
      ${sug.top.length ? `<div class="quick" aria-label="Česti opisi"><span>Često:</span>${sug.top.map((d) => `<button type="button" class="chip" data-desc="${esc(d)}" title="${esc(d)}">${esc(d)}</button>`).join('')}</div>` : ''}
      <div class="form-foot">
        <span class="hint" id="formHint"><span class="day-hint" id="dayHint"></span></span>
        <button class="btn primary" type="submit">${e ? `${icon('check')}Sačuvaj` : `${icon('plus')}Dodaj unos`}</button>
      </div>
      <datalist id="descList">${sug.all.slice(0, 200).map((d) => `<option value="${esc(d)}">`).join('')}</datalist>
    </div>
  </form>`;
}

function wireForm() {
  const f = $('#entryForm');
  if (!f) return;
  const upd = () => {
    const d = f.date.value;
    const hint = $('#formHint');
    const ph = f.hours.value.trim() ? C.parseHours(f.hours.value) : null;
    let txt = d ? `<span class="day-hint ${C.isWeekend(d) ? 'we' : ''}">${C.dayName(d)}${C.isWeekend(d) ? ' · vikend' : ''}</span>` : '';
    if (f.hours.value.trim()) {
      if (ph) { if (ph.expr || /[:,.]/.test(f.hours.value)) txt += ` · = ${C.fmtH(ph.hours)}`; f.hours.classList.remove('bad'); hint.classList.remove('bad'); }
      else { txt = 'Sati: broj do 24 (npr. 2, 1,5, 3+4 ili 1:30)'; hint.classList.add('bad'); }
    } else hint.classList.remove('bad');
    hint.innerHTML = txt;
  };
  f.addEventListener('input', upd);
  f.addEventListener('submit', onSubmitEntry);
  f.addEventListener('click', (ev) => {
    const h = ev.target.closest('[data-hours]');
    if (h) { f.hours.value = h.dataset.hours; upd(); (f.desc.value ? f.querySelector('[type=submit]') : f.desc).focus(); }
    const d = ev.target.closest('[data-desc]');
    if (d) { f.desc.value = d.dataset.desc; upd(); (f.hours.value ? f.querySelector('[type=submit]') : f.hours).focus(); }
  });
  upd();
  if (S.editId) setTimeout(() => { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.desc.focus(); }, 30);
}

function onSubmitEntry(ev) {
  ev.preventDefault();
  const f = ev.target;
  const date = f.date.value, desc = f.desc.value.trim(), note = f.note.value.trim();
  const ph = C.parseHours(f.hours.value);
  const bad = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad.push(f.date);
  if (!ph) bad.push(f.hours);
  if (!desc) bad.push(f.desc);
  f.querySelectorAll('.bad').forEach((x) => x.classList.remove('bad'));
  if (bad.length) {
    bad.forEach((x) => x.classList.add('bad'));
    bad[0].focus();
    toast(!ph && f.hours.value.trim() ? 'Sati nisu ispravni (npr. 2, 1,5, 3+4).' : 'Popuni datum, opis rada i sate.', { err: true });
    return;
  }
  const now = Date.now();
  if (S.editId) {
    const e = S.doc.entries.find((x) => x.id === S.editId);
    if (e) {
      Object.assign(e, { date, desc, note, hours: ph.hours, expr: ph.expr, u: now });
      if (f.period && f.period.value) e.period = f.period.value;
      S.flashId = e.id;
    }
    S.editId = null;
    mutate('Unos izmijenjen.');
  } else {
    const e = { id: C.uid(), date, desc, hours: ph.hours, expr: ph.expr, note, period: S.period, c: now, u: now };
    S.doc.entries.push(e);
    S.lastDate = date;
    S.flashId = e.id;
    mutate(`Dodano: ${C.fmtH(ph.hours)} — ${desc}`);
    const nf = $('#entryForm');
    if (nf && matchMedia('(min-width: 761px)').matches) nf.desc.focus();
  }
}

// ---------- pogled: Pregled ----------
function viewPregled() {
  const years = [...new Set(C.sortedPeriods(S.doc).map((p) => C.periodYear(p.id)))];
  if (!years.includes(S.year)) S.year = years.at(-1);
  const ps = C.sortedPeriods(S.doc).filter((p) => C.periodYear(p.id) === S.year);
  const all = C.live(S.doc).filter((e) => ps.some((p) => p.id === e.period));
  const st = C.periodStats(all);
  const per = ps.map((p) => ({ p, st: C.periodStats(C.entriesOf(S.doc, p.id)) }));
  const maxP = Math.max(1, ...per.map((x) => x.st.total));
  const avgP = per.length ? st.total / per.length : 0;
  const topIdx = per.reduce((bi, x, i) => (x.st.total > (per[bi]?.st.total ?? -1) ? i : bi), 0);
  const wd = C.weekdayHours(all);
  const maxW = Math.max(1, ...wd);
  const kw = C.keywordHours(all, 8);
  const maxK = Math.max(1, ...kw.map((k) => k.hours));
  const wdNames = ['Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota', 'Nedjelja'];

  return `
  <div class="year-bar">
    <h1>Pregled ${S.year}</h1>
    ${years.length > 1 ? `<div class="seg" role="group" aria-label="Godina">${years.map((y) => `<button data-year="${y}" aria-pressed="${y === S.year}">${y}</button>`).join('')}</div>` : ''}
    <button class="btn" data-act="xls-year">${icon('down')}Excel ${S.year}</button>
  </div>
  <div class="tiles">
    <section class="card tile"><span>Ukupno sati</span><b>${C.fmtHours(st.total)} h</b><small>${per.length} ${per.length === 1 ? 'period' : 'perioda'}</small></section>
    <section class="card tile"><span>Prosjek po mjesecu</span><b>${C.fmtHours(Math.round(avgP * 10) / 10)} h</b><small>najviše: ${per.length ? C.periodLabel(per[topIdx].p.id).split(' ')[0] : '—'}</small></section>
    <section class="card tile"><span>Broj unosa</span><b>${st.count}</b><small>${st.days} dana sa unosima</small></section>
    <section class="card tile"><span>Vikendom</span><b>${C.fmtHours(st.weekend)} h</b><small>${st.total ? Math.round(st.weekend / st.total * 100) : 0}% od ukupno</small></section>
  </div>
  <section class="card">
    <div class="card-h"><h2>Sati po periodu</h2></div>
    <div class="card-b">
      <div class="cols" role="img" aria-label="Sati po periodu: ${per.map((x) => `${C.periodLabel(x.p.id)} ${C.fmtHours(x.st.total)} h`).join(', ')}">
        ${per.map((x, i) => {
          const hi = x.p.status === 'open';
          const show = hi || i === topIdx;
          return `<div class="col ${hi ? 'hi' : ''}" title="${C.periodLabel(x.p.id)}: ${C.fmtH(x.st.total)} · ${x.st.count} unosa${hi ? ' · otvoren' : ''}">
            <span class="val ${show ? '' : 'quiet'}">${C.fmtHours(x.st.total)}</span>
            <div class="bar" style="height:${Math.max(1, x.st.total / maxP * 100)}%"></div></div>`;
        }).join('')}
      </div>
      <div class="col-labels">${per.map((x) => `<span>${C.periodShort(x.p.id).split(' ')[0]}</span>`).join('')}</div>
      <div class="chart-note"><span><i style="background:var(--bar)"></i>predat</span><span><i style="background:var(--bar-hi)"></i>otvoren (u toku)</span></div>
    </div>
  </section>
  <div class="two">
    <section class="card">
      <div class="card-h"><h2>Dani u sedmici</h2><span class="muted">sati</span></div>
      <div class="card-b hbars">
        ${wd.map((h, i) => `<div class="hb ${i >= 5 ? 'we' : ''}" title="${wdNames[i]}: ${C.fmtH(h)}"><span class="lab">${wdNames[i]}</span><span class="track"><span class="fill" style="width:${h / maxW * 100}%"></span></span><span class="v">${C.fmtHours(h)}</span></div>`).join('')}
      </div>
    </section>
    <section class="card">
      <div class="card-h"><h2>Najčešći rad</h2><span class="muted">ključne riječi iz opisa, sati</span></div>
      <div class="card-b hbars">
        ${kw.length ? kw.map((k) => `<div class="hb" title="${esc(k.word)}: ${C.fmtH(k.hours)} u ${k.count} unosa"><span class="lab">${esc(k.word)}</span><span class="track"><span class="fill" style="width:${k.hours / maxK * 100}%"></span></span><span class="v">${C.fmtHours(k.hours)}</span></div>`).join('') : '<p class="muted">Nema podataka.</p>'}
      </div>
    </section>
  </div>
  <section class="card" style="margin-top:14px">
    <div class="card-h"><h2>Periodi</h2><span class="muted">klik otvara period</span></div>
    <table class="ptable">
      <thead><tr><th>Period</th><th>Status</th><th class="r hide-s">Unosa</th><th class="r hide-s">Vikend</th><th class="r">Sati</th></tr></thead>
      <tbody>${per.slice().reverse().map((x) => `<tr data-open-period="${x.p.id}">
        <td><b>${C.periodLabel(x.p.id)}</b></td>
        <td>${x.p.status === 'open' ? '<span class="pill open">Otvoren</span>' : '<span class="pill closed">Predat</span>'}</td>
        <td class="r hide-s">${x.st.count}</td><td class="r hide-s">${C.fmtH(x.st.weekend)}</td><td class="r"><b>${C.fmtH(x.st.total)}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Ukupno</td><td></td><td class="r hide-s">${st.count}</td><td class="r hide-s">${C.fmtH(st.weekend)}</td><td class="r">${C.fmtH(st.total)}</td></tr></tfoot>
    </table>
  </section>`;
}

// ---------- pogled: Podesavanja ----------
function viewPostavke() {
  const pr = S.doc.profile;
  const t = themePref();
  const syncOk = S.token && S.sync.state !== 'error' && !S.pwMismatch;
  return `
  <div class="settings">
    <section class="card">
      <div class="card-h"><h2>Profil</h2><span class="muted">ide u zaglavlje Excela i štampe</span></div>
      <form class="card-b" id="profileForm">
        <label class="f">Ime i prezime <input class="in" value="${esc(pr.name)}" disabled></label>
        <div class="form-2">
          <label class="f">Pozicija <input class="in" name="position" value="${esc(pr.position || '')}"></label>
          <label class="f">Linija ispod naslova <input class="in" name="unit" value="${esc(pr.unit || '')}"></label>
        </div>
        <label class="f">Početak naziva Excel fajla <input class="in" name="filePrefix" value="${esc(pr.filePrefix || '')}" placeholder="npr. Trifa"></label>
        <div class="row"><button class="btn primary small" type="submit">Sačuvaj profil</button></div>
      </form>
    </section>

    <section class="card" id="syncCard">
      <div class="card-h"><h2>Čuvanje na GitHubu</h2></div>
      <div class="card-b">
        <p>Unosi se uvijek čuvaju na ovom uređaju. Da bi bili isti na telefonu i računaru, aplikacija ih šalje (šifrovane tvojom šifrom) u repozitorij <b>${C.REPO}</b>. Za slanje treba GitHub token — unosi se <b>jednom po uređaju</b>.</p>
        ${S.token ? `
          <div class="status-line ${syncOk ? 'ok' : 'err'}"><span class="dot"></span>${syncOk
            ? `Povezano · ${S.meta.lastSync ? `zadnje slanje ${C.fmtDate(C.toISO(new Date(S.meta.lastSync)))} u ${hhmm(S.meta.lastSync)}` : 'još nije slano'}${S.meta.dirty ? ' · ima izmjena koje čekaju' : ''}`
            : esc(S.pwMismatch ? 'Šifra je promijenjena na drugom uređaju.' : S.sync.err)}</div>
          <div class="row">
            <button class="btn small" data-act="sync-now">${icon('refresh')}Sinhronizuj sad</button>
            <button class="btn small danger" data-act="token-del">Ukloni token sa ovog uređaja</button>
          </div>`
        : `
          <ol class="steps">
            <li>Otvori <a href="${TOKEN_URL}" target="_blank" rel="noopener"><b>GitHub → novi token</b></a> (prijavljen kao TR1FA).</li>
            <li>Kod <b>Repository access</b> izaberi <b>Only select repositories → Prekovremeni</b>.</li>
            <li>Kod <b>Permissions → Contents</b> mora stajati <b>Read and write</b>.</li>
            <li><b>Generate token</b>, kopiraj ga i zalijepi ovdje.</li>
          </ol>
          <form class="row" id="tokenForm">
            <input class="in" name="token" type="password" autocomplete="off" placeholder="github_pat_…" style="flex:1;min-width:220px">
            <button class="btn primary" type="submit">Sačuvaj token</button>
          </form>`}
      </div>
    </section>

    <section class="card">
      <div class="card-h"><h2>Promjena šifre</h2></div>
      <form class="card-b" id="pwForm">
        ${S.token ? '' : '<p>Za promjenu šifre prvo poveži GitHub (iznad), da nova šifra važi na svim uređajima.</p>'}
        <div class="form-2">
          <label class="f">Trenutna šifra <input class="in" type="password" name="old" autocomplete="current-password" ${S.token ? '' : 'disabled'}></label>
          <span></span>
          <label class="f">Nova šifra <input class="in" type="password" name="n1" autocomplete="new-password" ${S.token ? '' : 'disabled'}></label>
          <label class="f">Ponovi novu šifru <input class="in" type="password" name="n2" autocomplete="new-password" ${S.token ? '' : 'disabled'}></label>
        </div>
        <div class="row"><button class="btn small" type="submit" ${S.token ? '' : 'disabled'}>Promijeni šifru</button></div>
      </form>
    </section>

    <section class="card">
      <div class="card-h"><h2>Izgled</h2></div>
      <div class="card-b">
        <div class="seg" role="group" aria-label="Tema">
          ${[['auto', 'Kao telefon'], ['light', 'Svijetla'], ['dark', 'Tamna']].map(([v, l]) => `<button data-theme-set="${v}" aria-pressed="${t === v}">${l}</button>`).join('')}
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-h"><h2>Rezervna kopija</h2></div>
      <div class="card-b">
        <p>JSON fajl sa svim unosima (nije šifrovan — čuvaj ga kod sebe). Uvoz spaja podatke, ništa ne briše.</p>
        <div class="row">
          <button class="btn small" data-act="backup">${icon('down')}Preuzmi kopiju</button>
          <button class="btn small" data-act="restore">${icon('up')}Uvezi kopiju</button>
          <button class="btn small" data-act="xls-all">${icon('down')}Excel — sve</button>
        </div>
      </div>
    </section>
    <p class="about">Prekovremeni ${VERSION} · podaci šifrovani (AES-256) tvojom šifrom — bez nje ih niko ne može pročitati, ni na GitHubu.</p>
  </div>`;
}

// ---------- akcije ----------
async function downloadBlob(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  const standaloneIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && (navigator.standalone || matchMedia('(display-mode: standalone)').matches);
  if (standaloneIOS && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const filePrefix = () => (S.doc.profile.filePrefix || S.doc.profile.name?.split(' ').at(-1) || 'Prekovremeni').replace(/[\\/:*?"<>|]/g, '');

async function exportExcel(pids, name, summaryTitle) {
  toast('Pravim Excel…', { ms: 8000 });
  try {
    const blob = await buildWorkbook(S.doc, pids, summaryTitle);
    await downloadBlob(blob, name);
    toast('Excel je spreman.');
  } catch (e) {
    console.error(e);
    toast(e.message || 'Excel nije uspio.', { err: true });
  }
}

function printPeriod(pid) {
  const list = C.entriesOf(S.doc, pid);
  const st = C.periodStats(list);
  const pr = S.doc.profile;
  const N = Math.max(20, list.length);
  let rows = '';
  for (let i = 0; i < N; i++) {
    const e = list[i];
    rows += e
      ? `<tr class="${C.isWeekend(e.date) ? 'we' : ''}"><td>${i + 1}</td><td>${C.fmtDate(e.date)}</td><td>${C.dayName(e.date)}</td><td class="l">${esc(e.desc)}</td><td>${C.fmtH(e.hours)}</td><td class="note">${esc(e.note || '')}</td></tr>`
      : '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>';
  }
  $('#print').innerHTML = `
  <div class="pf">
    <div class="pf-title">EVIDENCIJA PREKOVREMENIH SATI</div>
    <div class="pf-sub">${esc(pr.unit || '')}</div>
    <table class="pf-info">
      <tr><th>Zaposleni:</th><td>${esc(pr.name)}</td></tr>
      <tr><th>Pozicija:</th><td>${esc(pr.position || '')}</td></tr>
      <tr><th>Period:</th><td>${C.periodLabel(pid)}</td></tr>
      <tr><th>Ažurirano:</th><td>${C.fmtDate(C.todayISO())}</td></tr>
    </table>
    <table class="pf-tbl">
      <colgroup><col style="width:7%"><col style="width:13%"><col style="width:13%"><col style="width:36%"><col style="width:9%"><col style="width:22%"></colgroup>
      <thead><tr><th>R.br.</th><th>Datum</th><th>Dan</th><th>Opis rada</th><th>Sati</th><th>Napomena</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td class="lab" colspan="4">UKUPNO SATI:</td><td class="tot" colspan="2">${C.fmtH(st.total)}</td></tr></tfoot>
    </table>
    <div class="pf-sum-title">PREGLED</div>
    <table class="pf-sum">
      <tr><td>Ukupno sati:</td><td>${C.fmtH(st.total)}</td></tr>
      <tr><td>Broj unosa:</td><td>${st.count}</td></tr>
      <tr><td>Broj dana sa unosima:</td><td>${st.days}</td></tr>
      <tr><td>Prosječno sati po unosu:</td><td>${C.fmtHours(Math.round(st.avg * 10) / 10)} h</td></tr>
      <tr><td>Najduži pojedinačni unos:</td><td>${C.fmtH(st.max)}</td></tr>
      <tr><td>Sati odrađeni vikendom:</td><td>${C.fmtH(st.weekend)}</td></tr>
    </table>
    <div class="pf-sign">
      <div><span>Potpis zaposlenog:</span><span class="ln"></span><span>Datum:</span><span class="ln"></span></div>
      <div><span>Odobrio (rukovodilac):</span><span class="ln"></span><span>Datum:</span><span class="ln"></span></div>
    </div>
  </div>`;
  const old = document.title;
  document.title = `${filePrefix()}_prekovremeni_${C.periodLabel(pid).replace(' ', '_')}`;
  setTimeout(() => { window.print(); document.title = old; }, 50);
}

function deleteEntry(id) {
  const e = S.doc.entries.find((x) => x.id === id);
  if (!e) return;
  e.del = 1; e.u = Date.now();
  if (S.editId === id) S.editId = null;
  mutate(`Obrisano: ${e.desc}`, {
    action: { label: 'Poništi', fn: () => { e.del = 0; e.u = Date.now(); S.flashId = e.id; mutate('Vraćeno.'); } },
  });
}

function closePeriod() {
  const p = period();
  const next = C.nextPeriodId(p.id);
  const otherOpen = S.doc.periods.some((x) => x.status === 'open' && x.id !== p.id);
  if (!confirm(`Zaključiti ${C.periodLabel(p.id)} (predat)?\n\nUnosi postaju zaključani — period se može ponovo otvoriti.${otherOpen ? '' : `\nNovi unosi idu u ${C.periodLabel(next)}.`}`)) return;
  const now = Date.now();
  Object.assign(p, { status: 'closed', closedAt: now, u: now });
  if (!otherOpen) { const n = C.ensurePeriod(S.doc, next, now); if (n.status !== 'open') Object.assign(n, { status: 'open', u: now }); }
  S.period = C.latestOpenPeriod(S.doc);
  S.editId = null;
  mutate(`${C.periodLabel(p.id)} je zaključen.`);
}

function reopenPeriod() {
  const p = period();
  Object.assign(p, { status: 'open', closedAt: null, u: Date.now() });
  mutate(`${C.periodLabel(p.id)} je ponovo otvoren.`);
}

function goPeriod(dir) {
  const ps = C.sortedPeriods(S.doc);
  const i = ps.findIndex((x) => x.id === S.period);
  if (dir < 0 && i > 0) { S.period = ps[i - 1].id; S.editId = null; render(); return; }
  if (dir > 0) {
    if (i < ps.length - 1) { S.period = ps[i + 1].id; S.editId = null; render(); return; }
    const next = C.nextPeriodId(S.period);
    if (!confirm(`Otvoriti novi period ${C.periodLabel(next)}?`)) return;
    C.ensurePeriod(S.doc, next);
    S.period = next; S.editId = null;
    mutate(`Otvoren ${C.periodLabel(next)}.`);
  }
}

async function onSaveToken(ev) {
  ev.preventDefault();
  const token = ev.target.token.value.trim();
  if (!token) return;
  const btn = ev.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Provjeravam…';
  try {
    await C.ghCheckToken(token);
    S.token = token;
    const ok = await syncNow({ force: true, quiet: false });
    if (!ok) { S.token = null; render(); return; }
    await saveToken(token);
    toast('GitHub povezan — unosi se sad čuvaju i na GitHubu.');
    render();
  } catch (e) {
    S.token = null;
    toast(e.status === 401 ? 'Token nije ispravan.' : `Token ne radi: ${e.message}`, { err: true });
    btn.disabled = false; btn.textContent = 'Sačuvaj token';
  }
}

async function onChangePassword(ev) {
  ev.preventDefault();
  const f = ev.target;
  const oldPw = f.old.value, n1 = f.n1.value, n2 = f.n2.value;
  if (!S.token) return;
  if (n1.length < 6) { toast('Nova šifra mora imati bar 6 znakova.', { err: true }); return; }
  if (n1 !== n2) { toast('Nove šifre se ne poklapaju.', { err: true }); return; }
  const btn = f.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Mijenjam…';
  try {
    const testKey = await C.deriveKey(oldPw, S.salt, S.iter);
    try { await C.decryptDoc(readLocalBlob(S.uid), testKey); } catch { throw new Error('Trenutna šifra nije tačna.'); }
    if (!(await syncNow({ quiet: false }))) throw new Error('Prvo mora proći sinhronizacija.');
    const remote = await fetchRemote(S.uid, S.token);
    const merged = remote ? C.mergeDocs(S.doc, await C.decryptDoc(remote.blob, S.key)) : S.doc;
    const salt = C.newSalt();
    const key = await C.deriveKey(n1, salt, C.KDF_ITER, true);
    merged.saved = Date.now();
    const blob = await C.encryptDoc(merged, key, salt, C.KDF_ITER);
    await C.ghPut(dataPath(S.uid), JSON.stringify(blob) + '\n', remote?.sha, `Prekovremeni: promjena šifre (${S.doc.profile.name})`, S.token);
    Object.assign(S, { key, salt, iter: C.KDF_ITER, doc: merged });
    S.meta.dirty = false; S.meta.lastSync = Date.now();
    await saveToken(S.token);
    await saveLocal();
    const sess = { uid: S.uid, k: await C.exportKey(key), salt, iter: C.KDF_ITER, exp: Date.now() + SESSION_DAYS * 864e5 };
    (LS.get('pk_sess') ? LS : SS).set('pk_sess', JSON.stringify(sess));
    f.reset();
    toast('Šifra je promijenjena. Na drugim uređajima se prijavi novom šifrom.');
  } catch (e) {
    toast(e.message || 'Promjena šifre nije uspjela.', { err: true });
  } finally {
    btn.disabled = false; btn.textContent = 'Promijeni šifru';
  }
}

function backup() {
  const blob = new Blob([JSON.stringify(S.doc, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${filePrefix()}_prekovremeni_kopija_${C.todayISO()}.json`);
}

async function restore(file) {
  try {
    const doc = JSON.parse(await file.text());
    if (!Array.isArray(doc.entries) || !Array.isArray(doc.periods)) throw new Error('To nije kopija iz ove aplikacije.');
    const before = C.live(S.doc).length;
    S.doc = normalize(C.mergeDocs(S.doc, doc));
    mutate(`Uvezeno. Unosa: ${before} → ${C.live(S.doc).length}.`);
  } catch (e) {
    toast(e.message || 'Uvoz nije uspio.', { err: true });
  }
}

// ---------- dogadjaji ----------
function onClick(ev) {
  const t = ev.target.closest('[data-act],[data-view],[data-year],[data-theme-set],[data-open-period]');
  if (!t) return;
  if (t.dataset.view) { S.view = t.dataset.view; S.editId = null; render(); scrollTo({ top: 0 }); return; }
  if (t.dataset.year) { S.year = Number(t.dataset.year); render(); return; }
  if (t.dataset.themeSet) { setTheme(t.dataset.themeSet); render(); return; }
  if (t.dataset.openPeriod) { S.period = t.dataset.openPeriod; S.view = 'unos'; render(); scrollTo({ top: 0 }); return; }
  const id = t.dataset.id;
  switch (t.dataset.act) {
    case 'prev': goPeriod(-1); break;
    case 'next': goPeriod(1); break;
    case 'edit': S.editId = id; render(); break;
    case 'cancel-edit': S.editId = null; render(); break;
    case 'del': deleteEntry(id); break;
    case 'close': closePeriod(); break;
    case 'reopen': reopenPeriod(); break;
    case 'print': printPeriod(S.period); break;
    case 'xls-month': exportExcel([S.period], `${filePrefix()}_prekovremeni_${C.periodLabel(S.period).replace(' ', '_')}.xlsx`); break;
    case 'xls-year': {
      const ids = C.sortedPeriods(S.doc).filter((p) => C.periodYear(p.id) === S.year).map((p) => p.id);
      exportExcel(ids, `${filePrefix()}_prekovremeni_${S.year}.xlsx`, `Pregled ${S.year}`);
      break;
    }
    case 'xls-all': exportExcel(C.sortedPeriods(S.doc).map((p) => p.id), `${filePrefix()}_prekovremeni_sve.xlsx`, 'Pregled'); break;
    case 'sync':
      if (!S.token && !S.pwMismatch) { S.view = 'postavke'; render(); setTimeout(() => $('#syncCard')?.scrollIntoView({ behavior: 'smooth' }), 30); }
      else syncNow({ quiet: false }).then((ok) => ok && toast(S.token ? 'Sinhronizovano.' : 'Osvježeno.'));
      break;
    case 'sync-now': syncNow({ quiet: false }).then((ok) => { if (ok) toast('Sinhronizovano.'); render(); }); break;
    case 'token-del':
      if (confirm('Ukloniti GitHub token sa ovog uređaja? Unosi ostaju, ali se više neće slati na GitHub.')) {
        S.token = null; saveToken(null); setSync('idle'); render();
      }
      break;
    case 'theme': setTheme(effectiveDark() ? 'light' : 'dark'); if (S.view === 'postavke') render(); break;
    case 'logout': logout(); break;
    case 'backup': backup(); break;
    case 'restore': $('#importFile').click(); break;
    default: break;
  }
}

function onSubmit(ev) {
  if (ev.target.id === 'profileForm') {
    ev.preventDefault();
    const f = ev.target;
    Object.assign(S.doc.profile, {
      position: f.position.value.trim(), unit: f.unit.value.trim(), filePrefix: f.filePrefix.value.trim(), u: Date.now(),
    });
    mutate('Profil sačuvan.');
  } else if (ev.target.id === 'tokenForm') onSaveToken(ev);
  else if (ev.target.id === 'pwForm') onChangePassword(ev);
}

function onKey(ev) {
  if (ev.key === 'Escape' && S.editId) { S.editId = null; render(); }
}

function registerSW() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ---------- start ----------
async function boot() {
  applyTheme();
  registerSW();
  $('#loginForm').addEventListener('submit', onLogin);
  $('#pwEye').addEventListener('click', () => {
    const p = $('#loginPw');
    const show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    $('#pwEye').innerHTML = icon(show ? 'eyeOff' : 'eye');
    $('#pwEye').setAttribute('aria-label', show ? 'Sakrij šifru' : 'Prikaži šifru');
  });
  document.addEventListener('click', (ev) => { if (!$('#shell').hidden) onClick(ev); });
  document.addEventListener('submit', (ev) => { if (!$('#shell').hidden) onSubmit(ev); });
  document.addEventListener('keydown', onKey);
  $('#importFile').addEventListener('change', (ev) => { const f = ev.target.files[0]; ev.target.value = ''; if (f) restore(f); });
  addEventListener('online', () => S.key && syncNow());
  addEventListener('offline', () => setSync(S.sync.state));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.key && Date.now() - (S.lastPull || 0) > 60000) { S.lastPull = Date.now(); syncNow(); }
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

  S.users = await loadUsers();
  if (!(await resume())) showLogin(S.users.length ? '' : 'Ne mogu učitati listu korisnika (provjeri internet).');
}

boot();
