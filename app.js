/* ─────────────────────────────────────────────
   CONFIG — change SHEETS_URL here only
───────────────────────────────────────────── */
const CONFIG = {
  SHEETS_URL: localStorage.getItem('fs_sheets_url') || "https://script.google.com/macros/s/AKfycbxTWodRTVOpTOR_p_stZb19d1FcFlpARH11fm4shptxpvtSCgUvBkfCA1A2aZEdpuWqKQ/exec",
  CAR_NAME:   'Swift VDi DDiS 2010',
  CITY:       'Chandigarh',
  CITY_KML:   15.5,
  HWY_KML:    19.0,
  FALLBACK_DIESEL_PRICE: 88.74,
};

/* ─────────────────────────────────────────────
   STORAGE KEYS
───────────────────────────────────────────── */
const KEYS = {
  PEOPLE:      'fs_people',
  TRIPS:       'fs_trips',
  PRICE:       'fs_price',
  ACTIVE:      'fs_active_trip',
  THEME:       'fs_theme',
  SHEETS_URL:  'fs_sheets_url',
  NOTIF_ASKED: 'fs_notif_asked',
};

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
let people   = JSON.parse(localStorage.getItem(KEYS.PEOPLE) || '["Gurveer","Taj","Sehaj","Dhanveer","Bhupinder","Pinder","harman doda"]');
let trips    = JSON.parse(localStorage.getItem(KEYS.TRIPS)  || '[]');
let selected = new Set([people[0]]);
let livePrice = parseFloat(localStorage.getItem(KEYS.PRICE) || CONFIG.FALLBACK_DIESEL_PRICE);

/* ─────────────────────────────────────────────
   THEME
───────────────────────────────────────────── */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(KEYS.THEME, theme);
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.checked = (theme === 'dark');
}

function getTheme() {
  return localStorage.getItem(KEYS.THEME) ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

/* ─────────────────────────────────────────────
   CLOCK
───────────────────────────────────────────── */
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad(n) { return String(n).padStart(2, '0'); }

function updateClock() {
  const now = new Date();
  const clockEl = document.getElementById('nav-clock');
  const dateEl  = document.getElementById('nav-date');
  if (clockEl) clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  if (dateEl)  dateEl.textContent  = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

/* ─────────────────────────────────────────────
   LIVE DIESEL PRICE
───────────────────────────────────────────── */
async function fetchDieselPrice() {
  const heroEl    = document.getElementById('fuel-price-hero');
  const loadingEl = document.getElementById('fuel-loading');

  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent('https://www.goodreturns.in/fuel-price-in-chandigarh.html')}`;
    const res   = await fetch(proxy, { signal: AbortSignal.timeout(6000) });
    const json  = await res.json();
    const html  = json.contents || '';
    const match = html.match(/diesel[^₹\d]{0,30}([\d]{2,3}\.\d{2})/i);
    if (match) {
      livePrice = parseFloat(match[1]);
      localStorage.setItem(KEYS.PRICE, livePrice);
      if (heroEl)    heroEl.textContent     = '₹' + livePrice.toFixed(2);
      if (loadingEl) loadingEl.style.display = 'none';
      if (typeof recalc === 'function') recalc();
      return;
    }
  } catch (_) {}

  // Fallback to cached
  if (heroEl)    heroEl.textContent   = '₹' + livePrice.toFixed(2);
  if (loadingEl) loadingEl.textContent = '(cached)';
}

/* ─────────────────────────────────────────────
   TRIP CALCULATIONS
───────────────────────────────────────────── */
function calcTrip({ startOdo, endOdo, mileage, fuelPrice, passengers }) {
  const distance  = +(endOdo - startOdo).toFixed(2);
  const fuelUsed  = +(distance / mileage).toFixed(3);
  const totalCost = +(fuelUsed * fuelPrice).toFixed(2);
  const n         = passengers.length || 1;
  const perPerson = +(totalCost / n).toFixed(2);
  return { distance, fuelUsed, totalCost, perPerson };
}

/* ─────────────────────────────────────────────
   GOOGLE SHEETS SYNC
───────────────────────────────────────────── */
async function syncToSheets(payload) {
  const url = CONFIG.SHEETS_URL;
  if (!url) return { ok: false, reason: 'no_url' };
  try {
    await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain' },
      signal: AbortSignal.timeout(8000),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'fetch_error' };
  }
}

async function markDeletedInSheets(tripId) {
  const url = CONFIG.SHEETS_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', id: tripId }),
      headers: { 'Content-Type': 'text/plain' },
      signal: AbortSignal.timeout(8000),
    });
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   TRIP STORAGE
───────────────────────────────────────────── */
function saveTripsLocal() {
  localStorage.setItem(KEYS.TRIPS, JSON.stringify(trips));
}

function getActiveTrips() {
  return trips.filter(t => t.status !== 'deleted');
}

/* ─────────────────────────────────────────────
   ACTIVE TRIP
───────────────────────────────────────────── */
function getActiveTrip() {
  try { return JSON.parse(localStorage.getItem(KEYS.ACTIVE)); } catch (_) { return null; }
}

function setActiveTrip(data) {
  localStorage.setItem(KEYS.ACTIVE, JSON.stringify(data));
}

function clearActiveTrip() {
  localStorage.removeItem(KEYS.ACTIVE);
}

function formatDuration(startIso, endIso) {
  const diff = Math.floor((new Date(endIso) - new Date(startIso)) / 1000);
  const h    = Math.floor(diff / 3600);
  const m    = Math.floor((diff % 3600) / 60);
  const s    = diff % 60;
  return h > 0
    ? `${h}h ${pad(m)}m`
    : `${pad(m)}m ${pad(s)}s`;
}

function liveDuration(startIso) {
  const diff = Math.floor((Date.now() - new Date(startIso)) / 1000);
  const h    = Math.floor(diff / 3600);
  const m    = Math.floor((diff % 3600) / 60);
  const s    = diff % 60;
  return h > 0
    ? `${h}h ${pad(m)}m ${pad(s)}s`
    : `${pad(m)}m ${pad(s)}s`;
}

/* ─────────────────────────────────────────────
   BROWSER NOTIFICATIONS
───────────────────────────────────────────── */
async function requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (localStorage.getItem(KEYS.NOTIF_ASKED)) return;
  localStorage.setItem(KEYS.NOTIF_ASKED, '1');
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function sendNotif(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '' });
  } catch (_) {}
}

/* ─────────────────────────────────────────────
   PASSENGERS
───────────────────────────────────────────── */
function savePeople() {
  localStorage.setItem(KEYS.PEOPLE, JSON.stringify(people));
}

function renderChips() {
  const grid = document.getElementById('p-grid');
  if (!grid) return;
  grid.innerHTML = people.map(p =>
    `<div class="p-chip ${selected.has(p) ? 'on' : ''}" data-name="${p}" role="button" tabindex="0">${p}</div>`
  ).join('');
  grid.querySelectorAll('.p-chip').forEach(chip => {
    chip.addEventListener('click', () => togglePassenger(chip.dataset.name));
    chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') togglePassenger(chip.dataset.name); });
  });
  updatePcount();
}

function togglePassenger(name) {
  selected.has(name) ? selected.delete(name) : selected.add(name);
  renderChips();
  if (typeof recalc === 'function') recalc();
}

function addPerson() {
  const inp  = document.getElementById('new-person');
  if (!inp) return;
  const name = inp.value.trim();
  if (!name || people.includes(name)) { inp.value = ''; return; }
  people.push(name);
  selected.add(name);
  savePeople();
  inp.value = '';
  renderChips();
  if (typeof recalc === 'function') recalc();
}

function updatePcount() {
  const el = document.getElementById('pcount-display');
  if (el) el.textContent = selected.size > 0 ? `${selected.size} selected` : '';
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ─────────────────────────────────────────────
   SETTINGS PANEL
───────────────────────────────────────────── */
function openSettings() {
  document.getElementById('settings-panel')?.classList.add('open');
  document.getElementById('settings-overlay')?.classList.add('open');
  // Populate sheets URL
  const urlInput = document.getElementById('setting-sheets-url');
  if (urlInput) urlInput.value = CONFIG.SHEETS_URL || '';
}

function closeSettings() {
  document.getElementById('settings-panel')?.classList.remove('open');
  document.getElementById('settings-overlay')?.classList.remove('open');
}

function saveSettingsUrl() {
  const val = (document.getElementById('setting-sheets-url')?.value || '').trim();
  CONFIG.SHEETS_URL = val;
  localStorage.setItem(KEYS.SHEETS_URL, val);
  showToast('Settings saved');
  closeSettings();
}

/* ─────────────────────────────────────────────
   SHARED INIT (called on both pages)
───────────────────────────────────────────── */
function initShared() {
  applyTheme(getTheme());
  updateClock();
  setInterval(updateClock, 1000);
  requestNotifPermission();

  // Settings events
  document.getElementById('settings-btn')?.addEventListener('click', openSettings);
  document.getElementById('settings-overlay')?.addEventListener('click', closeSettings);
  document.getElementById('settings-close')?.addEventListener('click', closeSettings);
  document.getElementById('settings-save-url')?.addEventListener('click', saveSettingsUrl);

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'dark' : 'light'));
  }

  // New-person enter key
  document.getElementById('new-person')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addPerson();
  });

  // Add-person button
  document.getElementById('add-person-btn')?.addEventListener('click', addPerson);
}
