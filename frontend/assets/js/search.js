mountLayout('search');

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=600';

function roomCardHtml(room) {
  const img = room.images[0] || DEFAULT_IMG;
  const stars = '★'.repeat(Math.round(room.rating)) || '';
  const distanceLabel = room._distanceKm != null ? `<div class="room-meta">📍 à ${room._distanceKm.toFixed(1)} km</div>` : '';
  return `
  <a href="/room.html?id=${room.id}" class="room-card">
    <div class="room-img-wrap">
      <img src="${img}" alt="${escapeHtml(room.title)}">
      <span class="room-type-tag">${room.type}</span>
      <button class="fav-btn" data-room="${room.id}" aria-label="Ajouter aux favoris" onclick="event.preventDefault(); toggleFav(${room.id}, this)">♥</button>
    </div>
    <div class="room-body">
      <h3>${escapeHtml(room.title)}</h3>
      <div class="room-meta">${escapeHtml(room.city)}, ${escapeHtml(room.country)} · ${room.capacity_adults} adultes · ${room.bedrooms} ch.</div>
      ${distanceLabel}
      ${room.reviews_count > 0 ? `<div class="room-rating"><span class="stars">${stars}</span> ${room.rating} (${room.reviews_count})</div>` : `<div class="room-meta">Nouveau logement</div>`}
      <div class="room-price"><span class="amount">${money(room.price_per_night)}</span><span class="per-night">/ nuit</span></div>
    </div>
  </a>`;
}

async function toggleFav(roomId, btn) {
  if (!Auth.isLoggedIn()) { window.location.href = '/login.html'; return; }
  const isActive = btn.classList.contains('active');
  try {
    if (isActive) { await api(`/favorites/${roomId}`, { method: 'DELETE' }); btn.classList.remove('active'); }
    else { await api('/favorites', { method: 'POST', body: { room_id: roomId } }); btn.classList.add('active'); }
  } catch (err) { showToast('Erreur', err.message, 'warn'); }
}

function currentParams() {
  return new URLSearchParams(window.location.search);
}

function fillFiltersFromUrl() {
  const p = currentParams();
  if (p.get('city')) qs('f-city').value = p.get('city');
  if (p.get('min_price')) qs('f-min').value = p.get('min_price');
  if (p.get('max_price')) qs('f-max').value = p.get('max_price');
  if (p.get('adults')) qs('f-adults').value = p.get('adults');
  const type = p.get('type') || '';
  document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
}

async function runSearch() {
  const grid = qs('results-grid');
  grid.innerHTML = '<div class="skeleton" style="height:320px"></div><div class="skeleton" style="height:320px"></div><div class="skeleton" style="height:320px"></div>';
  const p = currentParams();
  try {
    const { rooms } = await api(`/rooms?${p.toString()}`, { auth: false });
    const city = p.get('city');
    qs('search-title').textContent = city ? `Logements à ${city}` : 'Tous les logements';
    qs('search-subtitle').textContent = `${rooms.length} logement${rooms.length > 1 ? 's' : ''} trouvé${rooms.length > 1 ? 's' : ''}`;

    if (!rooms.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i>🔍</i>Aucun logement ne correspond à votre recherche.<br>Essayez d'élargir vos critères.</div>`;
      return;
    }
    grid.innerHTML = rooms.map(roomCardHtml).join('');

    if (Auth.isLoggedIn()) {
      const { rooms: favs } = await api('/favorites').catch(() => ({ rooms: [] }));
      const favIds = new Set(favs.map(r => r.id));
      document.querySelectorAll('.fav-btn').forEach(btn => {
        if (favIds.has(Number(btn.dataset.room))) btn.classList.add('active');
      });
    }
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Impossible de charger les résultats : ${escapeHtml(err.message)}</div>`;
  }
}

document.querySelectorAll('.filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const p = currentParams();
    if (btn.dataset.type) p.set('type', btn.dataset.type); else p.delete('type');
    window.history.replaceState(null, '', `/search.html?${p.toString()}`);
    runSearch();
  });
});

qs('apply-filters').addEventListener('click', () => {
  const p = currentParams();
  const city = qs('f-city').value.trim();
  const country = qs('f-country').value;
  const min = qs('f-min').value;
  const max = qs('f-max').value;
  const adults = qs('f-adults').value;
  city ? p.set('city', city) : p.delete('city');
  country ? p.set('country', country) : p.delete('country');
  min ? p.set('min_price', min) : p.delete('min_price');
  max ? p.set('max_price', max) : p.delete('max_price');
  adults ? p.set('adults', adults) : p.delete('adults');
  window.history.replaceState(null, '', `/search.html?${p.toString()}`);
  runSearch();
});

async function loadCountries() {
  try {
    const { countries } = await api('/rooms/countries', { auth: false });
    const sel = qs('f-country');
    const current = currentParams().get('country') || '';
    sel.innerHTML = '<option value="">Tous les pays</option>' + countries.map(c => `<option value="${escapeHtml(c.country)}">${escapeHtml(c.country)} (${c.count})</option>`).join('');
    if (current) sel.value = current;
  } catch { /* silencieux */ }
}

qs('near-me-btn').addEventListener('click', async () => {
  const statusEl = qs('near-me-status');
  statusEl.textContent = 'Localisation en cours…';
  try {
    const pos = await getUserLocation();
    statusEl.textContent = `📍 Logements triés par proximité de votre position.`;
    const cards = document.querySelectorAll('#results-grid > a');
    const grid = qs('results-grid');
    const { rooms } = await api(`/rooms?${currentParams().toString()}`, { auth: false });
    const withDistance = rooms
      .filter(r => r.latitude != null && r.longitude != null)
      .map(r => ({ ...r, _distanceKm: haversineKm(pos.lat, pos.lon, r.latitude, r.longitude) }))
      .sort((a, b) => a._distanceKm - b._distanceKm);
    if (!withDistance.length) { statusEl.textContent = 'Aucun logement géolocalisé trouvé.'; return; }
    grid.innerHTML = withDistance.map(roomCardHtml).join('');
  } catch (err) {
    statusEl.textContent = err.message;
  }
});

fillFiltersFromUrl();
loadCountries();
runSearch();
