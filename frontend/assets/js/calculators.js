// Distance à vol d'oiseau entre deux points GPS (formule de Haversine), résultat en km.
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Géolocalisation non disponible sur cet appareil.'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(new Error("Impossible d'obtenir votre position : " + err.message)),
      { timeout: 8000 }
    );
  });
}

// Calcule une fourchette de prix/nuit recommandée à partir d'un budget total et d'un nombre de nuits.
function computeBudgetRange(totalBudget, nights) {
  if (!totalBudget || !nights) return null;
  const perNight = totalBudget / nights;
  return { perNight, min: Math.round(perNight * 0.6), max: Math.round(perNight * 1.05) };
}

function openBudgetCalculator() {
  const existing = document.getElementById('budget-modal');
  if (existing) { existing.classList.remove('hidden'); return; }

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'budget-modal';
  overlay.innerHTML = `
    <div class="modal">
      <button class="modal-close" id="budget-close">✕</button>
      <h2>💰 Calculateur de budget</h2>
      <p class="modal-sub">Indiquez votre budget total, on vous suggère la bonne gamme de prix par nuit.</p>
      <div class="field"><label>Budget total (€)</label><input type="number" id="bc-total" placeholder="Ex : 600"></div>
      <div class="field"><label>Nombre de nuits</label><input type="number" id="bc-nights" placeholder="Ex : 4"></div>
      <div id="bc-result" style="margin:16px 0;font-size:14px"></div>
      <button class="btn btn-primary btn-block" id="bc-search">Voir les logements dans ce budget</button>
    </div>`;
  document.body.appendChild(overlay);

  function compute() {
    const total = Number(qs('bc-total').value);
    const nights = Number(qs('bc-nights').value);
    const range = computeBudgetRange(total, nights);
    qs('bc-result').innerHTML = range
      ? `<div class="destination-box" style="background:var(--sand-deep)">Budget recommandé : <strong>${Math.round(range.min).toLocaleString('fr-FR')} € — ${Math.round(range.max).toLocaleString('fr-FR')} € / nuit</strong></div>`
      : '';
  }
  qs('bc-total').addEventListener('input', compute);
  qs('bc-nights').addEventListener('input', compute);
  qs('budget-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  qs('bc-search').addEventListener('click', () => {
    const total = Number(qs('bc-total').value);
    const nights = Number(qs('bc-nights').value) || 1;
    const range = computeBudgetRange(total, nights);
    if (!range) return;
    window.location.href = `/search.html?min_price=${Math.round(range.min)}&max_price=${Math.round(range.max)}`;
  });
}

// ---------- Calculateur de proximité (logement le plus proche de ma position) ----------
async function sortRoomsByDistance(rooms) {
  const loc = await getUserLocation();
  return rooms
    .map(r => ({ ...r, distanceKm: (r.latitude != null && r.longitude != null) ? haversineKm(loc.lat, loc.lon, r.latitude, r.longitude) : null }))
    .sort((a, b) => {
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
}
