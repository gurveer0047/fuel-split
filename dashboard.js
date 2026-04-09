/* dashboard.js — dashboard.html specific logic */

let lineChart  = null;
let donutChart = null;

/* ─────────────────────────────────────────────
   CHART THEME (adapts to light/dark)
───────────────────────────────────────────── */
function getChartTheme() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    text:    dark ? '#f5f5f7' : '#1d1d1f',
    muted:   dark ? '#636366' : '#98989d',
    border:  dark ? '#2c2c2e' : '#e5e5e5',
    surface: dark ? '#1c1c1e' : '#ffffff',
    line1:   dark ? '#f5f5f7' : '#1d1d1f',
    line2:   dark ? '#636366' : '#98989d',
  };
}

function buildTooltipConfig(theme) {
  return {
    backgroundColor: theme.surface,
    borderColor:     theme.border,
    borderWidth:     1,
    titleColor:      theme.text,
    bodyColor:       theme.muted,
    padding:         10,
    cornerRadius:    8,
  };
}

/* ─────────────────────────────────────────────
   STAT CARDS
───────────────────────────────────────────── */
function renderStats(visibleTrips) {
  if (visibleTrips.length === 0) {
    ['s-trips','s-km','s-spent','s-avg'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    return;
  }
  const totalKm    = visibleTrips.reduce((s,t) => s + t.distance, 0);
  const totalSpent = visibleTrips.reduce((s,t) => s + t.totalCost, 0);
  const avgPer     = visibleTrips.reduce((s,t) => s + t.perPerson, 0) / visibleTrips.length;

  document.getElementById('s-trips').textContent = visibleTrips.length;
  document.getElementById('s-km').textContent    = totalKm.toFixed(0);
  document.getElementById('s-spent').textContent = '₹' + totalSpent.toFixed(0);
  document.getElementById('s-avg').textContent   = '₹' + avgPer.toFixed(0);
}

/* ─────────────────────────────────────────────
   CHARTS
───────────────────────────────────────────── */
function renderCharts(visibleTrips) {
  const theme  = getChartTheme();
  const sorted = [...visibleTrips].sort((a,b) => new Date(a.date) - new Date(b.date));

  // ── Line chart
  const lineCtx = document.getElementById('chart-line').getContext('2d');
  if (lineChart) lineChart.destroy();

  lineChart = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: sorted.map(t => {
        const d = new Date(t.date);
        return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
      }),
      datasets: [
        {
          label: 'Total cost',
          data: sorted.map(t => t.totalCost),
          borderColor:     theme.line1,
          backgroundColor: theme.line1 + '0f',
          borderWidth: 1.5,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: theme.line1,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: 'Per person',
          data: sorted.map(t => t.perPerson),
          borderColor:  theme.line2,
          borderWidth:  1,
          tension: 0.4,
          fill: false,
          pointBackgroundColor: theme.line2,
          pointRadius: 2,
          borderDash: [4, 4],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: {
          display: true,
          labels: { color: theme.muted, font: { family: 'Inter', size: 11 }, boxWidth: 20, boxHeight: 1, padding: 16 },
        },
        tooltip: { ...buildTooltipConfig(theme), callbacks: { label: ctx => ` ₹${ctx.raw.toFixed(2)}` } },
      },
      scales: {
        x: {
          grid:  { color: theme.border },
          ticks: { color: theme.muted, font: { family: 'Inter', size: 11 } },
        },
        y: {
          grid:  { color: theme.border },
          ticks: { color: theme.muted, font: { family: 'Inter', size: 11 }, callback: v => '₹' + v },
        },
      },
    },
  });

  // ── Donut chart
  const city = visibleTrips.filter(t => t.mileageType === 'City').length;
  const hwy  = visibleTrips.filter(t => t.mileageType === 'Highway').length;
  const donutCtx = document.getElementById('chart-donut').getContext('2d');
  if (donutChart) donutChart.destroy();

  donutChart = new Chart(donutCtx, {
    type: 'doughnut',
    data: {
      labels: ['City', 'Highway'],
      datasets: [{
        data: [city, hwy],
        backgroundColor: [theme.line1 + 'cc', theme.line2 + '99'],
        borderColor:     [theme.line1,         theme.line2],
        borderWidth: 1,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: {
          display: true, position: 'bottom',
          labels: { color: theme.muted, font: { family: 'Inter', size: 11 }, boxWidth: 10, padding: 14 },
        },
        tooltip: { ...buildTooltipConfig(theme), callbacks: { label: ctx => ` ${ctx.raw} trips` } },
      },
      cutout: '68%',
    },
  });
}

/* ─────────────────────────────────────────────
   LEADERBOARD
───────────────────────────────────────────── */
function renderLeaderboard(visibleTrips) {
  const spend = {};
  const count = {};
  visibleTrips.forEach(t => {
    (t.passengers || []).forEach(p => {
      spend[p] = (spend[p] || 0) + t.perPerson;
      count[p] = (count[p] || 0) + 1;
    });
  });
  const sorted = Object.entries(spend).sort((a,b) => b[1] - a[1]).slice(0, 6);
  const max    = sorted[0]?.[1] || 1;
  const lb     = document.getElementById('leaderboard');

  if (sorted.length === 0) {
    lb.innerHTML = '<div style="color:var(--muted-2);font-size:13px;padding:16px 0">No data yet</div>';
    return;
  }

  lb.innerHTML = sorted.map(([name, amt], i) => `
    <div class="lb-row" role="listitem">
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${name}</span>
      <div class="lb-bar-wrap" aria-hidden="true">
        <div class="lb-bar" style="width:${((amt / max) * 100).toFixed(1)}%"></div>
      </div>
      <span class="lb-amt">₹${amt.toFixed(0)}</span>
      <span class="lb-trips">${count[name]}t</span>
    </div>
  `).join('');
}

/* ─────────────────────────────────────────────
   FILTER + SORT
───────────────────────────────────────────── */
function getFilteredSorted() {
  const search = document.getElementById('search-inp').value.toLowerCase().trim();
  const ftype  = document.getElementById('filter-type').value;
  const sortBy = document.getElementById('sort-by').value;

  let list = getActiveTrips(); // excludes deleted

  if (search) {
    list = list.filter(t =>
      t.name.toLowerCase().includes(search) ||
      (t.passengers || []).some(p => p.toLowerCase().includes(search))
    );
  }

  if (ftype) list = list.filter(t => t.mileageType === ftype);

  const sorters = {
    'date-desc': (a,b) => new Date(b.date) - new Date(a.date),
    'date-asc':  (a,b) => new Date(a.date) - new Date(b.date),
    'cost-desc': (a,b) => b.totalCost - a.totalCost,
    'cost-asc':  (a,b) => a.totalCost - b.totalCost,
    'dist-desc': (a,b) => b.distance  - a.distance,
  };

  list.sort(sorters[sortBy] || sorters['date-desc']);
  return list;
}

/* ─────────────────────────────────────────────
   RENDER TRIPS LIST
───────────────────────────────────────────── */
function renderTrips() {
  const list = getFilteredSorted();
  const el   = document.getElementById('trips-list');
  const all  = getActiveTrips();

  renderStats(list);
  renderLeaderboard(list);

  if (all.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛣️</div>
        <div class="empty-text">No trips yet.<br>
          <a href="index.html" class="empty-link">Log your first trip →</a>
        </div>
      </div>`;
    return;
  }

  if (list.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-text" style="padding:32px 0">No trips match your filters.</div></div>`;
    return;
  }

  el.innerHTML = list.map(t => {
    const d       = new Date(t.date);
    const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const typeClass = t.mileageType === 'Highway' ? 'highway' : 'city';
    const duration  = t.duration && t.duration !== '—' ? ` · ${t.duration}` : '';
    return `
      <div class="trip-card" role="listitem">
        <div>
          <div class="trip-name">${t.name}</div>
          <div class="trip-meta">${dateStr} · ${t.distance} km · ${t.fuelUsed} L · ₹${t.fuelPrice}/L${duration}</div>
          <div class="trip-chips">
            <span class="trip-chip ${typeClass}">${t.mileageType} · ${t.mileage} km/L</span>
            ${(t.passengers || []).map(p => `<span class="trip-chip">${p}</span>`).join('')}
          </div>
        </div>
        <div class="trip-right">
          <div class="trip-total">₹${t.totalCost.toFixed(0)}</div>
          <div class="trip-per">₹${t.perPerson.toFixed(0)}/person</div>
          <button class="trip-del" data-id="${t.id}" aria-label="Delete trip ${t.name}">✕</button>
        </div>
      </div>`;
  }).join('');

  // Bind delete buttons
  el.querySelectorAll('.trip-del').forEach(btn => {
    btn.addEventListener('click', () => deleteTrip(Number(btn.dataset.id)));
  });
}

/* ─────────────────────────────────────────────
   DELETE (marks as deleted, notifies backend)
───────────────────────────────────────────── */
async function deleteTrip(id) {
  const trip = trips.find(t => t.id === id);
  if (!trip) return;

  trip.status = 'deleted';
  saveTripsLocal();
  renderTrips();
  renderCharts(getFilteredSorted());
  showToast('Trip removed');

  // Notify backend — does not delete sheet row, just marks status
  markDeletedInSheets(id);
}

/* ─────────────────────────────────────────────
   CSV EXPORT
───────────────────────────────────────────── */
function exportCSV() {
  const active = getActiveTrips();
  if (active.length === 0) { showToast('No trips to export'); return; }

  const headers = [
    'Trip name','Date','Start time','End time','Duration',
    'Start ODO','End ODO','Distance (km)','Fuel (L)',
    'Fuel price (₹/L)','Drive type','Mileage (km/L)',
    'Total cost (₹)','Per person (₹)','Passengers',
  ];

  const rows = active.map(t => [
    `"${t.name}"`,
    t.date,
    t.startTime || '',
    t.endTime   || '',
    t.duration  || '',
    t.startOdo, t.endOdo, t.distance, t.fuelUsed,
    t.fuelPrice, t.mileageType, t.mileage,
    t.totalCost, t.perPerson,
    `"${(t.passengers || []).join(', ')}"`,
  ]);

  const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `fuel_split_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV exported — open in Google Sheets');
}

/* ─────────────────────────────────────────────
   RE-RENDER ON THEME CHANGE
───────────────────────────────────────────── */
function refreshChartsOnTheme() {
  renderCharts(getFilteredSorted());
}

/* ─────────────────────────────────────────────
   PAGE INIT
───────────────────────────────────────────── */
(function initDashboard() {
  initShared();

  renderTrips();
  renderCharts(getFilteredSorted());

  // Controls
  document.getElementById('search-inp')?.addEventListener('input', () => {
    renderTrips();
    renderCharts(getFilteredSorted());
  });

  document.getElementById('filter-type')?.addEventListener('change', () => {
    renderTrips();
    renderCharts(getFilteredSorted());
  });

  document.getElementById('sort-by')?.addEventListener('change', renderTrips);

  document.getElementById('btn-export-csv')?.addEventListener('click', exportCSV);

  // Re-draw charts when theme changes (the toggle fires a change event via app.js)
  document.getElementById('theme-toggle')?.addEventListener('change', () => {
    setTimeout(refreshChartsOnTheme, 120); // let CSS vars settle first
  });
})();
