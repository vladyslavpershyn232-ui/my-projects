/* Мои проекты — учёт проектов, задач и денег. Данные в localStorage. */
(function () {
'use strict';

const KEY = 'rita.work.v1';
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

let state = load();
let T = I18N[state.lang] || I18N.ru;
let openIds = {};

/* ---------- хранилище ---------- */

function blank() {
  return { v: 1, lang: 'ru', theme: 'light', projects: [] };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.projects)) return blank();
    return { v: 1, lang: d.lang === 'uk' ? 'uk' : 'ru',
             theme: d.theme === 'dark' ? 'dark' : 'light',
             projects: d.projects.map(normProject) };
  } catch (e) { return blank(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}
function normProject(p) {
  p = p || {};
  return {
    id:     p.id || uid(),
    name:   str(p.name),
    client: str(p.client),
    status: STATUS_ORDER.indexOf(p.status) >= 0 ? p.status : 'talks',
    start:  str(p.start),
    due:    str(p.due),
    price:  num(p.price),
    paid:   num(p.paid),
    cur:    CURRENCIES.indexOf(p.cur) >= 0 ? p.cur : '₴',
    auto:   !!p.auto,
    link:   str(p.link),
    note:   str(p.note),
    created: p.created || Date.now(),
    tasks: Array.isArray(p.tasks) ? p.tasks.map(t => ({
      id: (t && t.id) || uid(), title: str(t && t.title),
      done: !!(t && t.done), price: num(t && t.price)
    })) : []
  };
}
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function str(v) { return v == null ? '' : String(v); }
function num(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) && n > 0 ? n : 0;
}

/* ---------- деньги и даты ---------- */

function priceOf(p) {
  if (!p.auto) return p.price;
  return p.tasks.reduce((s, t) => s + t.price, 0);
}
function fmtMoney(n) {
  const r = Math.round(n * 100) / 100;
  const s = (Math.abs(r % 1) > 0.001 ? r.toFixed(2) : String(Math.round(r)));
  const parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join(',');
}
function money(n, cur) { return fmtMoney(n) + ' ' + cur; }
function today() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function pad(n) { return n < 10 ? '0' + n : String(n); }
function fmtDate(iso) {
  if (!iso) return '';
  const p = iso.split('-');
  if (p.length !== 3) return iso;
  return p[2] + '.' + p[1] + '.' + p[0];
}
function isLate(p) {
  if (!p.due) return false;
  if (p.status === 'done' || p.status === 'paid' || p.status === 'off') return false;
  return p.due < today();
}
function daysTo(iso) {
  const a = new Date(today() + 'T00:00:00');
  const b = new Date(iso + 'T00:00:00');
  return Math.round((b - a) / 86400000);
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
function fillSelects() {
  const fs = $('#fstatus'), keep = fs.value;
  fs.innerHTML = '';
  fs.appendChild(opt('', T.allStatuses));
  STATUS_ORDER.forEach(s => fs.appendChild(opt(s, T.statuses[s])));
  fs.value = keep;

  const so = $('#sort'), keepS = so.value;
  so.innerHTML = '';
  [['due', T.sortDue], ['new', T.sortNew], ['name', T.sortName], ['price', T.sortPrice]]
    .forEach(p => so.appendChild(opt(p[0], p[1])));
  so.value = keepS || 'due';

  const ms = $('#fStatus'), keepM = ms.value;
  ms.innerHTML = '';
  STATUS_ORDER.forEach(s => ms.appendChild(opt(s, T.statuses[s])));
  ms.value = keepM || 'talks';

  const mc = $('#fCur'), keepC = mc.value;
  mc.innerHTML = '';
  CURRENCIES.forEach(c => mc.appendChild(opt(c, c)));
  mc.value = keepC || '₴';
}
function opt(v, label) {
  const o = document.createElement('option');
  o.value = v; o.textContent = label;
  return o;
}

/* ---------- отрисовка ---------- */

function visible() {
  const q = $('#q').value.trim().toLowerCase();
  const st = $('#fstatus').value;
  const sort = $('#sort').value || 'due';
  let list = state.projects.slice();

  if (st) list = list.filter(p => p.status === st);
  if (q) list = list.filter(p => {
    const hay = [p.name, p.client, p.note].concat(p.tasks.map(t => t.title)).join(' ').toLowerCase();
    return hay.indexOf(q) >= 0;
  });

  list.sort((a, b) => {
    if (sort === 'name')  return a.name.localeCompare(b.name, 'uk');
    if (sort === 'new')   return b.created - a.created;
    if (sort === 'price') return priceOf(b) - priceOf(a);
    if (!a.due && !b.due) return b.created - a.created;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
  });
  return list;
}

function renderTiles() {
  const act = state.projects.filter(p => ACTIVE_ST.indexOf(p.status) >= 0);
  const late = state.projects.filter(isLate);
  const dueM = {}, gotM = {};
  state.projects.forEach(p => {
    if (p.status === 'off') return;
    const total = priceOf(p);
    const rest = Math.max(0, total - p.paid);
    if (rest > 0) dueM[p.cur] = (dueM[p.cur] || 0) + rest;
    if (p.paid > 0) gotM[p.cur] = (gotM[p.cur] || 0) + p.paid;
  });
  $('#tiles').innerHTML =
    tile('', T.tileActive, '<span class="ln">' + act.length + '<span class="u"> ' + esc(pluralWord(act.length)) + '</span></span>') +
    tile('', T.tileDue, moneyLines(dueM)) +
    tile('got', T.tileGot, moneyLines(gotM)) +
    tile(late.length ? 'late' : '', T.tileLate,
         '<span class="ln">' + late.length + '<span class="u"> ' + esc(pluralWord(late.length)) + '</span></span>');
}
function moneyLines(m) {
  const keys = CURRENCIES.filter(c => m[c]);
  if (!keys.length) return '<span class="ln">—</span>';
  return keys.map(c => '<span class="ln">' + esc(money(m[c], c)) + '</span>').join('');
}
function tile(cls, lab, val) {
  return '<div class="tile ' + cls + '"><div class="lab">' + esc(lab) + '</div><div class="val">' + val + '</div></div>';
}

function renderList() {
  const list = visible();
  const box = $('#list');
  box.innerHTML = list.map(cardHtml).join('');
  $('#empty').classList.toggle('hidden', state.projects.length > 0);
  $('#count').textContent = state.projects.length ? plural(list.length) : '';
}
function pluralWord(n) {
  const a = n % 10, b = n % 100;
  return (a === 1 && b !== 11) ? T.countOne
       : (a >= 2 && a <= 4 && (b < 10 || b >= 20)) ? T.countFew : T.countMany;
}
function plural(n) { return n + ' ' + pluralWord(n); }

function cardHtml(p) {
  const total = priceOf(p), rest = Math.max(0, total - p.paid), late = isLate(p);
  const open = !!openIds[p.id];
  const metas = [];
  if (p.due) {
    const d = daysTo(p.due);
    metas.push('<span class="' + (late ? 'late' : '') + '">' + esc(T.due) + ' ' + esc(fmtDate(p.due)) +
      (late ? ' · ' + Math.abs(d) + ' д' : (d >= 0 && d <= 7 ? ' · ' + d + ' д' : '')) + '</span>');
  }
  if (p.start) metas.push('<span>' + esc(T.started) + ' ' + esc(fmtDate(p.start)) + '</span>');
  if (p.tasks.length) {
    const done = p.tasks.filter(t => t.done).length;
    metas.push('<span>' + esc(T.tasks) + ' ' + done + '/' + p.tasks.length + '</span>');
  }

  let paidLine = '', sumLine;
  if (total > 0) {
    sumLine = '<div class="psum">' + esc(money(total, p.cur)) + '</div>';
    if (p.paid <= 0) paidLine = '<div class="ppaid">' + esc(T.nothingPaid) + '</div>';
    else if (rest <= 0) paidLine = '<div class="ppaid full">' + esc(T.paidFull) + '</div>';
    else paidLine = '<div class="ppaid">' + esc(T.left) + ' ' + esc(money(rest, p.cur)) + '</div>';
  } else if (p.paid > 0) {
    sumLine = '<div class="psum">' + esc(money(p.paid, p.cur)) + '</div>';
    paidLine = '<div class="ppaid full">' + esc(T.paidFull) + '</div>';
  } else {
    sumLine = '<div class="psum hint">\u2014</div>';
  }

  return '<article class="proj' + (open ? ' open' : '') + (late ? ' isLate' : '') + '" data-id="' + p.id + '">' +
    '<div class="phead" data-act="toggle">' +
      '<div class="chev">▶</div>' +
      '<div class="pmain">' +
        '<div class="pname">' + esc(p.name) +
          '<span class="tag ' + (late ? 'bad' : STATUS_TONE[p.status]) + '">' + esc(T.statuses[p.status]) + '</span>' +
        '</div>' +
        (p.client ? '<div class="pclient">' + esc(p.client) + '</div>' : '') +
        (metas.length ? '<div class="pmeta">' + metas.join('') + '</div>' : '') +
      '</div>' +
      '<div class="pmoney">' +
        sumLine + paidLine +
      '</div>' +
    '</div>' +
    (open ? bodyHtml(p) : '') +
  '</article>';
}

function bodyHtml(p) {
  const tasks = p.tasks.length
    ? '<ul class="tasks">' + p.tasks.map(t =>
        '<li class="task' + (t.done ? ' done' : '') + '" data-tid="' + t.id + '">' +
          '<input type="checkbox" data-act="task-done"' + (t.done ? ' checked' : '') + '>' +
          '<span class="tt">' + esc(t.title) + '</span>' +
          (t.price > 0 ? '<span class="tp">' + esc(money(t.price, p.cur)) + '</span>' : '') +
          '<button type="button" class="tdel" data-act="task-del" aria-label="×">✕</button>' +
        '</li>').join('') + '</ul>'
    : '<p class="sub" style="margin-bottom:12px">' + esc(T.noTasks) + '</p>';

  return '<div class="pbody">' +
    (p.note ? '<p class="pnote">' + esc(p.note) + '</p>' : '') +
    (p.link ? '<a class="plink" href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(p.link) + '</a>' : '') +
    '<p class="ptitle">' + esc(T.tasks) + '</p>' +
    tasks +
    '<div class="newtask">' +
      '<input class="inp ti" data-act="task-title" placeholder="' + esc(T.taskPh) + '">' +
      '<input class="inp tpr" data-act="task-price" inputmode="decimal" placeholder="' + esc(p.cur) + '">' +
      '<button type="button" class="btn" data-act="task-add">' + esc(T.addTask) + '</button>' +
    '</div>' +
    '<div class="pacts">' +
      '<button type="button" class="minibtn" data-act="edit">' + esc(T.edit) + '</button>' +
    '</div>' +
  '</div>';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function render() { renderTiles(); renderList(); }

/* ---------- модалка ---------- */

let editId = null;

function openModal(p) {
  editId = p ? p.id : null;
  $('#mtitle').textContent = p ? T.mEdit : T.mNew;
  $('#mdel').classList.toggle('hidden', !p);
  $('#fName').value   = p ? p.name : '';
  $('#fClient').value = p ? p.client : '';
  $('#fStatus').value = p ? p.status : 'talks';
  $('#fStart').value  = p ? p.start : today();
  $('#fDue').value    = p ? p.due : '';
  $('#fPrice').value  = p && p.price ? p.price : '';
  $('#fPaid').value   = p && p.paid ? p.paid : '';
  $('#fCur').value    = p ? p.cur : '₴';
  $('#fAuto').checked = p ? p.auto : false;
  $('#fLink').value   = p ? p.link : '';
  $('#fNote').value   = p ? p.note : '';
  syncAuto();
  $('#modal').classList.remove('hidden');
  setTimeout(() => $('#fName').focus(), 30);
}
function closeModal() { $('#modal').classList.add('hidden'); editId = null; }
function syncAuto() { $('#fPrice').disabled = $('#fAuto').checked; }

function saveModal() {
  const name = $('#fName').value.trim();
  if (!name) { alert(T.needName); $('#fName').focus(); return; }
  const data = {
    name: name,
    client: $('#fClient').value.trim(),
    status: $('#fStatus').value,
    start: $('#fStart').value,
    due: $('#fDue').value,
    price: num($('#fPrice').value),
    paid: num($('#fPaid').value),
    cur: $('#fCur').value,
    auto: $('#fAuto').checked,
    link: $('#fLink').value.trim(),
    note: $('#fNote').value.trim()
  };
  if (editId) {
    const p = find(editId);
    if (p) Object.keys(data).forEach(k => { p[k] = data[k]; });
  } else {
    const p = normProject(data);
    state.projects.push(p);
    openIds[p.id] = true;
  }
  save(); render(); closeModal();
}
function find(id) { return state.projects.filter(p => p.id === id)[0]; }

/* ---------- CSV и копии ---------- */

function exportCsv() {
  const h = T.csv;
  const rows = [[h.name, h.client, h.status, h.start, h.due, h.price, h.paid, h.left,
                 h.cur, h.tasks, h.tasksDone, h.note, h.link]];
  state.projects.forEach(p => {
    const total = priceOf(p);
    rows.push([p.name, p.client, T.statuses[p.status], fmtDate(p.start), fmtDate(p.due),
      total || '', p.paid || '', Math.max(0, total - p.paid) || '', p.cur,
      p.tasks.map(t => t.title).join(' | '),
      p.tasks.filter(t => t.done).length + '/' + p.tasks.length,
      p.note, p.link]);
  });
  const csv = '﻿' + rows.map(r => r.map(c => {
    const s = String(c == null ? '' : c);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\r\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'projects-' + today() + '.csv');
}
function backup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  download(blob, 'projects-backup-' + today() + '.json');
}
function restore(file) {
  const fr = new FileReader();
  fr.onload = () => {
    let d;
    try { d = JSON.parse(fr.result); } catch (e) { alert(T.badFile); return; }
    if (!d || !Array.isArray(d.projects)) { alert(T.badFile); return; }
    if (!confirm(T.confirmRestore)) return;
    state.projects = d.projects.map(normProject);
    if (d.lang === 'uk' || d.lang === 'ru') state.lang = d.lang;
    openIds = {};
    save(); applyLang(); render();
    alert(T.restored);
  };
  fr.readAsText(file);
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 200);
}

/* ---------- события ---------- */

$('#theme').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  save(); applyTheme();
});
$('#lang').addEventListener('click', () => {
  state.lang = state.lang === 'ru' ? 'uk' : 'ru';
  save(); applyLang(); render();
});
$('#add').addEventListener('click', () => openModal(null));
$('#q').addEventListener('input', renderList);
$('#fstatus').addEventListener('change', renderList);
$('#sort').addEventListener('change', renderList);
$('#exportCsv').addEventListener('click', exportCsv);
$('#backup').addEventListener('click', backup);
$('#restore').addEventListener('click', () => $('#restoreFile').click());
$('#restoreFile').addEventListener('change', e => {
  if (e.target.files && e.target.files[0]) restore(e.target.files[0]);
  e.target.value = '';
});

$('#msave').addEventListener('click', saveModal);
$('#mcancel').addEventListener('click', closeModal);
$('#mclose').addEventListener('click', closeModal);
$('#fAuto').addEventListener('change', syncAuto);
$('#mdel').addEventListener('click', () => {
  if (!editId || !confirm(T.confirmDel)) return;
  state.projects = state.projects.filter(p => p.id !== editId);
  save(); render(); closeModal();
});
$('#modal').addEventListener('mousedown', e => { if (e.target === $('#modal')) closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal();
});

$('#list').addEventListener('click', e => {
  const art = e.target.closest('.proj'); if (!art) return;
  const p = find(art.getAttribute('data-id')); if (!p) return;
  const hit = e.target.closest('[data-act]');
  const act = hit ? hit.getAttribute('data-act') : null;

  if (act === 'toggle') { openIds[p.id] = !openIds[p.id]; renderList(); return; }
  if (act === 'edit')   { openModal(p); return; }
  if (act === 'task-add') { addTask(p, art); return; }
  if (act === 'task-del') {
    const li = e.target.closest('.task');
    p.tasks = p.tasks.filter(t => t.id !== li.getAttribute('data-tid'));
    save(); render(); return;
  }
});
$('#list').addEventListener('change', e => {
  if (!e.target.matches('[data-act="task-done"]')) return;
  const art = e.target.closest('.proj'), li = e.target.closest('.task');
  const p = find(art.getAttribute('data-id')); if (!p) return;
  const t = p.tasks.filter(x => x.id === li.getAttribute('data-tid'))[0];
  if (t) { t.done = e.target.checked; save(); render(); }
});
$('#list').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (!e.target.matches('[data-act="task-title"],[data-act="task-price"]')) return;
  const art = e.target.closest('.proj');
  const p = find(art.getAttribute('data-id'));
  if (p) addTask(p, art);
});
function addTask(p, art) {
  const ti = $('[data-act="task-title"]', art), tp = $('[data-act="task-price"]', art);
  const title = ti.value.trim();
  if (!title) { ti.focus(); return; }
  p.tasks.push({ id: uid(), title: title, done: false, price: num(tp.value) });
  save(); render();
  const again = $('.proj[data-id="' + p.id + '"] [data-act="task-title"]');
  if (again) again.focus();
}

/* ---------- старт ---------- */

applyTheme();
applyLang();
$('#sort').value = 'due';
render();
})();
