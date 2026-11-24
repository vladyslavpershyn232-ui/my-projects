/* Мои проекты — учёт задач, клиентов и денег. Данные в localStorage. */
(function () {
'use strict';

const KEY = 'rita.work.v2';
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

let state = load();
let T = I18N[state.lang] || I18N.ru;
let openIds = {};
let editId = null;

/* ---------- хранилище ---------- */

function blank() { return { app:'my-projects', version:2, lang:'ru', theme:'light', tasks:[] }; }

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const d = JSON.parse(raw);
    const s = fromAny(d);
    return s || blank();
  } catch (e) { return blank(); }
}
/* понимает и свой формат, и выгрузку из прежнего трекера */
function fromAny(d) {
  if (!d || typeof d !== 'object') return null;
  if (!Array.isArray(d.tasks)) return null;
  return {
    app: 'my-projects', version: 2,
    lang:  d.lang === 'uk' ? 'uk' : 'ru',
    theme: d.theme === 'dark' ? 'dark' : 'light',
    tasks: d.tasks.map(normTask)
  };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

function normTask(t) {
  t = t || {};
  const cur = String(t.currency || 'UAH').toUpperCase();
  return {
    id:       t.id || uid(),
    task:     str(t.task || t.name || t.title),
    client:   str(t.client),
    month:    monthOf(t),
    created:  dateStr(t.created),
    deadline: dateStr(t.deadline || t.due),
    status:   STATUS_ORDER.indexOf(t.status) >= 0 ? t.status : 'new',
    currency: CURRENCIES[cur] ? cur : 'UAH',
    cost:     num(t.cost != null ? t.cost : t.price),
    paid:     num(t.paid),
    notes:    str(t.notes != null ? t.notes : t.note)
  };
}
function monthOf(t) {
  const m = str(t.month);
  if (/^\d{4}-\d{2}$/.test(m)) return m;
  const c = dateStr(t.created);
  return c ? c.slice(0, 7) : thisMonth();
}
function dateStr(v) {
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function str(v) { return v == null ? '' : String(v); }
function num(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) && n > 0 ? n : 0;
}

/* ---------- даты и деньги ---------- */

function today() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
function thisMonth() { return today().slice(0, 7); }
function pad(n) { return n < 10 ? '0' + n : String(n); }
function fmtDate(iso) { if (!iso) return ''; const p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
function fmtMonth(m) {
  if (!/^\d{4}-\d{2}$/.test(m)) return m;
  const p = m.split('-');
  return T.months[parseInt(p[1], 10) - 1] + ' ' + p[0];
}
function sym(c) { return CURRENCIES[c] || c; }
function fmtMoney(n) {
  const r = Math.round(n * 100) / 100;
  const s = Math.abs(r % 1) > 0.001 ? r.toFixed(2) : String(Math.round(r));
  const p = s.split('.');
  p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return p.join(',');
}
function money(n, cur) { return fmtMoney(n) + ' ' + sym(cur); }
function payState(t) {
  if (t.cost <= 0) return t.paid > 0 ? 'yes' : 'no';
  if (t.paid <= 0) return 'no';
  return t.paid >= t.cost ? 'yes' : 'part';
}

/* ---------- тема и язык ---------- */

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  $('#theme').textContent = state.theme === 'dark' ? '☀' : '☾';
}
function applyLang() {
  T = I18N[state.lang];
  document.documentElement.setAttribute('lang', T.htmlLang);
  document.title = T.title;
  $('#lang').textContent = T.other;
  $$('[data-t]').forEach(el => { const k = el.getAttribute('data-t'); if (T[k]) el.textContent = T[k]; });
  $$('[data-tp]').forEach(el => { const k = el.getAttribute('data-tp'); if (T[k]) el.placeholder = T[k]; });
  fillSelects();
}
function opt(v, label) { const o = document.createElement('option'); o.value = v; o.textContent = label; return o; }
function refill(sel, pairs, keepValue) {
  const keep = keepValue !== undefined ? keepValue : sel.value;
  sel.innerHTML = '';
  pairs.forEach(p => sel.appendChild(opt(p[0], p[1])));
  const has = pairs.some(p => p[0] === keep);
  sel.value = has ? keep : pairs[0][0];
}
function fillSelects() {
  const clients = uniq(state.tasks.map(t => t.client).filter(Boolean)).sort((a, b) => a.localeCompare(b, 'uk'));
  const months  = uniq(state.tasks.map(t => t.month).filter(Boolean)).sort().reverse();

  refill($('#fclient'), [['', T.allClients]].concat(clients.map(c => [c, c])));
  refill($('#fmonth'),  [['', T.allMonths]].concat(months.map(m => [m, fmtMonth(m)])));
  refill($('#fstatus'), [['', T.allStatuses]].concat(STATUS_ORDER.map(s => [s, T.statuses[s]])));
  refill($('#fpay'),    [['', T.allPay], ['no', T.payNo], ['part', T.payPart], ['yes', T.payYes]]);
  refill($('#group'),   [['client', T.groupClient], ['month', T.groupMonth], ['none', T.groupNone]]);
  refill($('#fStatus'), STATUS_ORDER.map(s => [s, T.statuses[s]]));
  refill($('#fCur'),    CUR_ORDER.map(c => [c, sym(c) + ' ' + c]));

  $('#clients').innerHTML = clients.map(c => '<option value="' + esc(c) + '">').join('');
}
function uniq(a) { return a.filter((v, i) => a.indexOf(v) === i); }

/* ---------- выборка ---------- */

function visible() {
  const q  = $('#q').value.trim().toLowerCase();
  const fc = $('#fclient').value, fm = $('#fmonth').value;
  const fs = $('#fstatus').value, fp = $('#fpay').value;
  return state.tasks.filter(t => {
    if (fc && t.client !== fc) return false;
    if (fm && t.month !== fm) return false;
    if (fs && t.status !== fs) return false;
    if (fp && payState(t) !== fp) return false;
    if (q && (t.task + ' ' + t.client + ' ' + t.notes).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
function sums(list) {
  const m = {};
  list.forEach(t => {
    const a = m[t.currency] || (m[t.currency] = { cost: 0, paid: 0 });
    a.cost += t.cost; a.paid += t.paid;
  });
  return m;
}
function moneyLines(m, pick) {
  const keys = CUR_ORDER.filter(c => m[c] && pick(m[c]) > 0);
  if (!keys.length) return '<span class="ln">—</span>';
  return keys.map(c => '<span class="ln">' + esc(money(pick(m[c]), c)) + '</span>').join('');
}

/* ---------- отрисовка ---------- */

function render() { fillSelects(); renderTiles(); renderList(); }

function renderTiles() {
  const all = state.tasks;
  const work = all.filter(t => OPEN_ST.indexOf(t.status) >= 0);
  const debt = all.filter(t => t.status === 'done' && payState(t) !== 'yes');
  const m = sums(all), dm = sums(debt);
  $('#tiles').innerHTML =
    tile('', T.tileWork, '<span class="ln">' + work.length + '<span class="u"> ' + esc(pluralWord(work.length)) + '</span></span>') +
    tile('due', T.tileDue, moneyLines(m, a => a.cost - a.paid)) +
    tile('got', T.tileGot, moneyLines(m, a => a.paid)) +
    tile(debt.length ? 'late' : '', T.tileDebt,
      '<span class="ln">' + debt.length + '<span class="u"> ' + esc(pluralWord(debt.length)) + '</span></span>' +
      (debt.length ? moneyLines(dm, a => a.cost - a.paid) : ''));
}
function tile(cls, lab, val) {
  return '<div class="tile ' + cls + '"><div class="lab">' + esc(lab) + '</div><div class="val">' + val + '</div></div>';
}
function pluralWord(n) {
  const a = n % 10, b = n % 100;
  return (a === 1 && b !== 11) ? T.countOne
       : (a >= 2 && a <= 4 && (b < 10 || b >= 20)) ? T.countFew : T.countMany;
}

function renderList() {
  const list = visible();
  const mode = $('#group').value;
  const box = $('#list');

  $('#empty').classList.toggle('hidden', state.tasks.length > 0);
  $('#count').textContent = state.tasks.length ? list.length + ' ' + pluralWord(list.length) : '';

  if (!list.length) {
    box.innerHTML = state.tasks.length
      ? '<div class="card empty"><p class="sub">' + esc(T.noTasks) + '</p></div>' : '';
    return;
  }

  if (mode === 'none') { box.innerHTML = '<div class="group">' + rows(list) + '</div>'; return; }

  const keyOf = t => mode === 'client' ? (t.client || '—') : t.month;
  const keys = uniq(list.map(keyOf));
  keys.sort(mode === 'month'
    ? (a, b) => (a < b ? 1 : a > b ? -1 : 0)
    : (a, b) => {
        const d = debtOf(list.filter(t => keyOf(t) === b)) - debtOf(list.filter(t => keyOf(t) === a));
        return d !== 0 ? d : a.localeCompare(b, 'uk');
      });

  box.innerHTML = keys.map(k => {
    const part = list.filter(t => keyOf(t) === k);
    const m = sums(part);
    const parts = CUR_ORDER.filter(c => m[c]).map(c => {
      const left = m[c].cost - m[c].paid;
      return '<span>' + esc(T.total) + ' ' + esc(money(m[c].cost, c)) + '</span>' +
        (left > 0 ? '<span class="gdebt">' + esc(T.debt) + ' ' + esc(money(left, c)) + '</span>' : '');
    }).join('');
    return '<div class="group">' +
      '<div class="ghead"><div class="gname">' + esc(mode === 'month' ? fmtMonth(k) : k) +
        '<span class="gcount">' + part.length + '</span></div>' +
        '<div class="gsum">' + parts + '</div></div>' +
      rows(part) + '</div>';
  }).join('');
}
function debtOf(list) {
  return list.reduce((s, t) => s + Math.max(0, t.cost - t.paid), 0);
}

function rows(list) {
  const order = { work: 0, review: 1, new: 2, done: 3 };
  list = list.slice().sort((a, b) => {
    const d = order[a.status] - order[b.status];
    if (d) return d;
    return (b.created || '') < (a.created || '') ? -1 : 1;
  });
  return list.map(rowHtml).join('');
}

function rowHtml(t) {
  const ps = payState(t), left = Math.max(0, t.cost - t.paid);
  const open = !!openIds[t.id];
  const flag = t.status === 'done' && ps !== 'yes';

  let pay;
  if (ps === 'yes')      pay = '<span class="pay ok">' + esc(T.paidFull) + '</span>';
  else if (ps === 'part') pay = '<span class="pay part">' + esc(T.paidPart) + ' ' + esc(money(t.paid, t.currency)) + '</span>';
  else                    pay = '<span class="pay no">' + esc(T.notPaid) + '</span>';

  return '<article class="row' + (open ? ' open' : '') + (flag ? ' flag' : '') + '" data-id="' + t.id + '">' +
    '<div class="rhead" data-act="toggle">' +
      '<span class="tag ' + STATUS_TONE[t.status] + '">' + esc(T.statuses[t.status]) + '</span>' +
      '<div class="rmain">' +
        '<div class="rname">' + esc(t.task) + (t.notes ? ' <span class="hasnote">•</span>' : '') + '</div>' +
        '<div class="rsub">' + esc(t.client) + (t.client && t.month ? ' · ' : '') + esc(fmtMonth(t.month)) + '</div>' +
      '</div>' +
      '<div class="rmoney">' +
        '<div class="rcost">' + (t.cost > 0 ? esc(money(t.cost, t.currency)) : '—') + '</div>' +
        pay +
      '</div>' +
    '</div>' +
    (open ? '<div class="rbody">' +
      (t.notes ? '<p class="rnote">' + esc(t.notes) + '</p>' : '') +
      '<div class="rmeta">' +
        (t.created ? '<span>' + esc(T.created) + ' ' + esc(fmtDate(t.created)) + '</span>' : '') +
        (t.deadline ? '<span>' + esc(T.deadline) + ' ' + esc(fmtDate(t.deadline)) + '</span>' : '') +
        (left > 0 && t.cost > 0 ? '<span>' + esc(T.left) + ' ' + esc(money(left, t.currency)) + '</span>' : '') +
      '</div>' +
      '<div class="racts">' +
        '<button type="button" class="minibtn" data-act="edit">' + esc(T.edit) + '</button>' +
        (t.status !== 'done' ? '<button type="button" class="minibtn" data-act="done">' + esc(T.markDone) + '</button>' : '') +
        (ps !== 'yes' && t.cost > 0 ? '<button type="button" class="minibtn" data-act="paid">' + esc(T.markPaid) + '</button>' : '') +
      '</div>' +
    '</div>' : '') +
  '</article>';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- модалка ---------- */

function openModal(t) {
  editId = t ? t.id : null;
  $('#mtitle').textContent = t ? T.mEdit : T.mNew;
  $('#mdel').classList.toggle('hidden', !t);
  $('#fTask').value     = t ? t.task : '';
  $('#fClient').value   = t ? t.client : '';
  $('#fStatus').value   = t ? t.status : 'new';
  $('#fMonth').value    = t ? t.month : thisMonth();
  $('#fCreated').value  = t ? t.created : today();
  $('#fDeadline').value = t ? t.deadline : '';
  $('#fCost').value     = t && t.cost ? t.cost : '';
  $('#fPaid').value     = t && t.paid ? t.paid : '';
  $('#fCur').value      = t ? t.currency : 'UAH';
  $('#fNotes').value    = t ? t.notes : '';
  $('#modal').classList.remove('hidden');
  setTimeout(() => $('#fTask').focus(), 30);
}
function closeModal() { $('#modal').classList.add('hidden'); editId = null; }

function saveModal() {
  const task = $('#fTask').value.trim();
  if (!task) { alert(T.needTask); $('#fTask').focus(); return; }
  const data = {
    task: task,
    client: $('#fClient').value.trim(),
    status: $('#fStatus').value,
    month: $('#fMonth').value || thisMonth(),
    created: $('#fCreated').value,
    deadline: $('#fDeadline').value,
    cost: num($('#fCost').value),
    paid: num($('#fPaid').value),
    currency: $('#fCur').value,
    notes: $('#fNotes').value.trim()
  };
  if (editId) {
    const t = find(editId);
    if (t) Object.keys(data).forEach(k => { t[k] = data[k]; });
  } else {
    const t = normTask(data);
    state.tasks.unshift(t);
    openIds[t.id] = true;
  }
  save(); render(); closeModal();
}
function find(id) { return state.tasks.filter(t => t.id === id)[0]; }

/* ---------- файлы ---------- */

function exportCsv() {
  const h = T.csv;
  const rows = [[h.task, h.client, h.month, h.created, h.deadline, h.status,
                 h.cost, h.paid, h.left, h.cur, h.notes]];
  state.tasks.forEach(t => rows.push([
    t.task, t.client, fmtMonth(t.month), fmtDate(t.created), fmtDate(t.deadline),
    T.statuses[t.status], t.cost || '', t.paid || '',
    Math.max(0, t.cost - t.paid) || '', t.currency, t.notes
  ]));
  const csv = '﻿' + rows.map(r => r.map(c => {
    const s = String(c == null ? '' : c);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\r\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'tasks-' + today() + '.csv');
}
function backup() {
  download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }),
           'my-projects-' + today() + '.json');
}
function loadFile(file) {
  const fr = new FileReader();
  fr.onload = () => {
    let d;
    try { d = JSON.parse(fr.result); } catch (e) { alert(T.badFile); return; }
    const s = fromAny(d);
    if (!s) { alert(T.badFile); return; }
    if (state.tasks.length && !confirm(T.confirmLoad)) return;
    state.tasks = s.tasks;
    if (d.lang === 'uk' || d.lang === 'ru') state.lang = d.lang;
    openIds = {};
    save(); applyLang(); render();
    alert(T.loaded + s.tasks.length);
  };
  fr.readAsText(file);
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 200);
}

/* ---------- события ---------- */

$('#theme').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme();
});
$('#lang').addEventListener('click', () => {
  state.lang = state.lang === 'ru' ? 'uk' : 'ru'; save(); applyLang(); render();
});
$('#add').addEventListener('click', () => openModal(null));
$('#q').addEventListener('input', renderList);
['#fclient', '#fmonth', '#fstatus', '#fpay', '#group'].forEach(s =>
  $(s).addEventListener('change', renderList));
$('#exportCsv').addEventListener('click', exportCsv);
$('#backup').addEventListener('click', backup);
$('#restore').addEventListener('click', () => $('#restoreFile').click());
$('#restoreFile').addEventListener('change', e => {
  if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]);
  e.target.value = '';
});
$('#msave').addEventListener('click', saveModal);
$('#mcancel').addEventListener('click', closeModal);
$('#mclose').addEventListener('click', closeModal);
$('#mdel').addEventListener('click', () => {
  if (!editId || !confirm(T.confirmDel)) return;
  state.tasks = state.tasks.filter(t => t.id !== editId);
  save(); render(); closeModal();
});
$('#modal').addEventListener('mousedown', e => { if (e.target === $('#modal')) closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal();
});
$('#list').addEventListener('click', e => {
  const art = e.target.closest('.row'); if (!art) return;
  const t = find(art.getAttribute('data-id')); if (!t) return;
  const hit = e.target.closest('[data-act]');
  const act = hit ? hit.getAttribute('data-act') : null;
  if (act === 'toggle') { openIds[t.id] = !openIds[t.id]; renderList(); return; }
  if (act === 'edit')   { openModal(t); return; }
  if (act === 'done')   { t.status = 'done'; save(); render(); return; }
  if (act === 'paid')   { t.paid = t.cost; save(); render(); return; }
});

/* ---------- старт ---------- */

applyTheme();
applyLang();
render();
})();
