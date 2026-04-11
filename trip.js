/* trip.js — index.html specific logic */

/* ── RECALC (live cost preview) ── */
function recalc() {
  const start   = parseFloat(document.getElementById('odo-start').value);
  const end     = parseFloat(document.getElementById('odo-end').value);
  const mileage = parseFloat(document.querySelector('input[name=mileage]:checked').value);
  const card    = document.getElementById('result-card');
  const distEl  = document.getElementById('dist-display');

  if (!start || !end || end <= start) {
    card.classList.remove('show');
    distEl.textContent = '';
    return;
  }

  // UPDATED: use manual fuel price input if available
  const fuelPrice = parseFloat(document.getElementById('fuel-price')?.value) || livePrice;
  const { distance, fuelUsed, totalCost, perPerson } = calcTrip({
    startOdo: start, endOdo: end, mileage, fuelPrice: fuelPrice,
    passengers: [...selected],
  });
  const n = selected.size || 1;

  distEl.textContent = distance.toFixed(1) + ' km';

  document.getElementById('r-dist').textContent  = distance.toFixed(1) + ' km';
  document.getElementById('r-fuel').textContent  = fuelUsed.toFixed(2) + ' L';
  document.getElementById('r-total').textContent = '₹' + totalCost.toFixed(2);
  document.getElementById('r-per').textContent   = '₹' + perPerson.toFixed(2);
  document.getElementById('r-sub').textContent   = `split across ${n} ${n === 1 ? 'person' : 'people'}`;

  document.getElementById('split-list').innerHTML = [...selected].map(p =>
    `<div class="split-row">
      <span class="name">${p}</span>
      <span class="amt">₹${perPerson.toFixed(2)}</span>
    </div>`
  ).join('');

  card.classList.add('show');
  updatePcount();
}

/* ── START TRIP ── */
function handleStartTrip() {
  const startOdo  = parseFloat(document.getElementById('odo-start').value);
  const mileage   = parseFloat(document.querySelector('input[name=mileage]:checked').value);
  const mtype     = mileage === CONFIG.CITY_KML ? 'City' : 'Highway';
  const tripName  = document.getElementById('trip-name').value.trim() || 'Trip';

  if (!startOdo) { showToast('Enter a start odometer reading first'); return; }
  if (selected.size === 0) { showToast('Select at least one passenger'); return; }

  const activeTrip = {
    name:       tripName,
    startOdo,
    startTime:  new Date().toISOString(),
    passengers: [...selected],
    mileage,
    mileageType: mtype,
    date:       document.getElementById('trip-date').value,
  };

  setActiveTrip(activeTrip);
  sendNotif('Trip started', `${tripName} — ODO: ${startOdo} km`);
  showActiveTripBanner();
  showToast('Trip started! Tap "Finish Trip" when you arrive.');
}

/* ── FINISH TRIP ── */
async function handleFinishTrip() {
  const active = getActiveTrip();
  if (!active) return;

  const endOdo = parseFloat(document.getElementById('atb-odo-end').value);
  if (!endOdo || endOdo <= active.startOdo) {
    showToast('Enter a valid end odometer reading');
    return;
  }

  const endTime = new Date().toISOString();
  const { distance, fuelUsed, totalCost, perPerson } = calcTrip({
    startOdo:   active.startOdo,
    endOdo,
    mileage:    active.mileage,
    fuelPrice:  livePrice,
    passengers: active.passengers,
  });

  const trip = {
    id:          Date.now(),
    name:        active.name,
    date:        active.date,
    startTime:   active.startTime,
    endTime,
    duration:    formatDuration(active.startTime, endTime),
    startOdo:    active.startOdo,
    endOdo,
    distance,
    fuelUsed,
    fuelPrice:   livePrice,
    mileageType: active.mileageType,
    mileage:     active.mileage,
    totalCost,
    perPerson,
    passengers:  active.passengers,
    status:      'active',
  };

  trips.unshift(trip);
  saveTripsLocal();
  clearActiveTrip();
  hideActiveTripBanner();

  sendNotif('Trip finished!', `${trip.name} — ₹${perPerson.toFixed(2)}/person`);

  const syncResult = await syncToSheets(trip);
  if (syncResult.ok) {
    showToast('Trip saved & synced to Sheets!');
  } else if (syncResult.reason === 'no_url') {
    showToast('Trip saved! (Add Sheets URL in Settings to sync)');
  } else {
    showToast('Trip saved — Sheets sync failed');
  }

  setTimeout(() => { window.location.href = 'dashboard.html'; }, 1400);
}

/* ── SAVE TRIP (manual, without start/stop) ── */
async function handleSaveTrip() {
  const name    = document.getElementById('trip-name').value.trim() || 'Unnamed trip';
  const date    = document.getElementById('trip-date').value;
  const startOdo = parseFloat(document.getElementById('odo-start').value);
  const endOdo   = parseFloat(document.getElementById('odo-end').value);
  const mileage  = parseFloat(document.querySelector('input[name=mileage]:checked').value);
  const mtype    = mileage === CONFIG.CITY_KML ? 'City' : 'Highway';

  if (!startOdo || !endOdo || endOdo <= startOdo) {
    showToast('Enter valid odometer readings');
    return;
  }
  if (selected.size === 0) {
    showToast('Select at least one passenger');
    return;
  }

  const now = new Date().toISOString();
  const { distance, fuelUsed, totalCost, perPerson } = calcTrip({
    startOdo, endOdo, mileage, fuelPrice: livePrice, passengers: [...selected],
  });

  const trip = {
    id:          Date.now(),
    name, date,
    startTime:   now,
    endTime:     now,
    duration:    '—',
    startOdo, endOdo,
    distance, fuelUsed,
    fuelPrice:   livePrice,
    mileageType: mtype,
    mileage, totalCost, perPerson,
    passengers:  [...selected],
    status:      'active',
  };

  trips.unshift(trip);
  saveTripsLocal();

  const btn = document.getElementById('btn-save-trip');
  const txt = document.getElementById('submit-text');
  btn.classList.add('loading');
  txt.textContent = 'Syncing…';

  const syncResult = await syncToSheets(trip);
  btn.classList.remove('loading');
  txt.textContent = 'Save Trip & Sync to Sheets';

  if (syncResult.ok) {
    showToast('Saved & synced to Sheets!');
  } else if (syncResult.reason === 'no_url') {
    showToast('Saved locally! Add Sheets URL in Settings.');
  } else {
    showToast('Saved — Sheets sync failed');
  }

  resetForm();
  setTimeout(() => { window.location.href = 'dashboard.html'; }, 1400);
}

/* ── ACTIVE TRIP BANNER ── */
let durationInterval;

function showActiveTripBanner() {
  const active  = getActiveTrip();
  if (!active) return;

  const banner = document.getElementById('active-trip-banner');
  const form   = document.getElementById('form-section');
  banner.classList.add('visible');
  if (form) form.style.opacity = '0.4';
  if (form) form.style.pointerEvents = 'none';

  document.getElementById('atb-title').textContent = active.name || 'Trip in progress';
  document.getElementById('atb-meta').textContent  =
    `Started ${new Date(active.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · ODO ${active.startOdo} km · ${active.passengers.length} passenger${active.passengers.length !== 1 ? 's' : ''}`;

  clearInterval(durationInterval);
  durationInterval = setInterval(() => {
    document.getElementById('atb-duration').textContent = liveDuration(active.startTime);
  }, 1000);
}

function hideActiveTripBanner() {
  clearInterval(durationInterval);
  document.getElementById('active-trip-banner').classList.remove('visible');
  const form = document.getElementById('form-section');
  if (form) { form.style.opacity = ''; form.style.pointerEvents = ''; }
}

function handleCancelTrip() {
  if (!confirm('Cancel the current trip? This cannot be undone.')) return;
  clearActiveTrip();
  hideActiveTripBanner();
  showToast('Trip cancelled');
}

/* ── RESET FORM ── */
function resetForm() {
  document.getElementById('odo-start').value = '';
  document.getElementById('odo-end').value   = '';
  document.getElementById('trip-name').value = '';
  document.getElementById('result-card').classList.remove('show');
  document.getElementById('dist-display').textContent = '';
}

// ADDED
function getLastEndOdo() {
  const activeTrips = trips.filter(t => t.status !== 'deleted');
  if (activeTrips.length === 0) return '';
  return activeTrips[0].endOdo;
}

/* ── PAGE INIT ── */
(function initTripPage() {
  // Shared init (theme, clock, settings panel)
  initShared();

  // Set today's date
  document.getElementById('trip-date').value = new Date().toISOString().split('T')[0];

  // Passengers
  renderChips();

  // ADDED: fuel price input init
  const fuelInput = document.getElementById('fuel-price');
  if (fuelInput) {
    fuelInput.value = livePrice;
    fuelInput.addEventListener('input', () => {
      const val = parseFloat(fuelInput.value);
      if (!isNaN(val) && val > 0) {
        livePrice = val;
        localStorage.setItem(KEYS.PRICE, val);
        recalc();
      }
    });
  }

  // ADDED: auto-fill start odometer if empty
  const startInput = document.getElementById('odo-start');
  if (startInput && !startInput.value) {
    const lastOdo = getLastEndOdo();
    if (lastOdo) startInput.value = lastOdo;
  }

  // Fetch live price
  fetchDieselPrice();

  // Check for active trip on load
  if (getActiveTrip()) showActiveTripBanner();

  // Wire up ODO inputs
  ['odo-start', 'odo-end'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', recalc);
  });

  // Wire up mileage radios
  document.querySelectorAll('input[name=mileage]').forEach(r => {
    r.addEventListener('change', recalc);
  });

  // Buttons
  document.getElementById('btn-start-trip')?.addEventListener('click', handleStartTrip);
  document.getElementById('btn-save-trip')?.addEventListener('click', handleSaveTrip);
  document.getElementById('btn-finish-trip')?.addEventListener('click', handleFinishTrip);
  document.getElementById('btn-cancel-trip')?.addEventListener('click', handleCancelTrip);

  // Notification toggle sync
  const notifToggle = document.getElementById('notif-toggle');
  if (notifToggle) {
    notifToggle.checked = Notification?.permission === 'granted';
    notifToggle.addEventListener('change', async () => {
      if (notifToggle.checked) await Notification.requestPermission();
    });
  }
})();
