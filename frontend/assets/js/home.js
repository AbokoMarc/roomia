mountLayout('home');

const CITY_IMAGES = {
  'Yaoundé': 'https://images.unsplash.com/photo-1580746738099-90e6e2ce8b31?q=80&w=600',
  'Douala': 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?q=80&w=600',
  'Kribi': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=600',
  'Buea': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=600',
};
const DEFAULT_CITY_IMG = 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=600';

function roomCardHtml(room) {
  const img = room.images[0] || DEFAULT_CITY_IMG;
  const stars = '★'.repeat(Math.round(room.rating)) || '';
  return `
  <a href="/room.html?id=${room.id}" class="room-card">
    <div class="room-img-wrap">
      <img src="${img}" alt="${escapeHtml(room.title)}">
      <span class="room-type-tag">${room.type}</span>
      <button class="fav-btn" data-room="${room.id}" aria-label="Ajouter aux favoris" onclick="event.preventDefault(); toggleFav(${room.id}, this)">♥</button>
    </div>
    <div class="room-body">
      <h3>${escapeHtml(room.title)}</h3>
      <div class="room-meta">${escapeHtml(room.city)} · ${room.capacity_adults} adultes · ${room.bedrooms} ch.</div>
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

async function loadCities() {
  try {
    const { cities } = await api('/rooms/cities', { auth: false });
    const grid = qs('cities-grid');
    const dl = qs('city-options');
    if (dl) dl.innerHTML = cities.map(c => `<option value="${escapeHtml(c.city)}">`).join('');
    if (!cities.length) { grid.innerHTML = `<div class="empty-state"><i>🏙️</i>Aucune ville disponible pour l'instant.</div>`; return; }
    grid.innerHTML = cities.map(c => `
      <a href="/search.html?city=${encodeURIComponent(c.city)}" class="city-card">
        <div class="city-img"><img src="${CITY_IMAGES[c.city] || DEFAULT_CITY_IMG}" alt="${escapeHtml(c.city)}"></div>
        <div class="city-body"><h3>${escapeHtml(c.city)}</h3><p>${c.count} logement${c.count > 1 ? 's' : ''}</p></div>
      </a>`).join('');
  } catch (err) { qs('cities-grid').innerHTML = `<div class="empty-state">Impossible de charger les villes.</div>`; }
}

async function loadFeatured() {
  try {
    const { rooms } = await api('/rooms', { auth: false });
    const grid = qs('featured-grid');
    const featured = rooms.filter(r => r.featured).slice(0, 6);
    const list = featured.length ? featured : rooms.slice(0, 6);
    if (!list.length) { grid.innerHTML = `<div class="empty-state"><i>🏠</i>Aucun logement disponible pour l'instant.</div>`; return; }
    grid.innerHTML = list.map(roomCardHtml).join('');

    if (Auth.isLoggedIn()) {
      const { rooms: favs } = await api('/favorites').catch(() => ({ rooms: [] }));
      const favIds = new Set(favs.map(r => r.id));
      document.querySelectorAll('.fav-btn').forEach(btn => {
        if (favIds.has(Number(btn.dataset.room))) btn.classList.add('active');
      });
    }
  } catch (err) { qs('featured-grid').innerHTML = `<div class="empty-state">Impossible de charger les logements.</div>`; }
}

async function loadCountries() {
  try {
    const { countries } = await api('/rooms/countries', { auth: false });
    const sel = qs('f-country');
    sel.innerHTML = '<option value="" style="color:#000">Tous les pays</option>' +
      countries.map(c => `<option value="${escapeHtml(c.country)}" style="color:#000">${escapeHtml(c.country)} (${c.count})</option>`).join('');
  } catch { /* silencieux */ }
}

qs('hero-search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const params = new URLSearchParams();
  const city = qs('f-city').value.trim();
  const checkin = qs('f-checkin').value;
  const checkout = qs('f-checkout').value;
  const purpose = qs('f-purpose').value;
  const type = qs('f-type').value;
  const country = qs('f-country').value;
  if (city) params.set('city', city);
  if (checkin) params.set('check_in', checkin);
  if (checkout) params.set('check_out', checkout);
  if (purpose) params.set('purpose', purpose);
  if (type) params.set('type', type);
  if (country) params.set('country', country);
  window.location.href = `/search.html?${params.toString()}`;
});

loadCities();
loadCountries();
loadFeatured();
