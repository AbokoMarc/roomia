mountLayout('search');

const roomId = new URLSearchParams(window.location.search).get('id');
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=900';
let currentRoom = null;

function galleryHtml(images) {
  const imgs = images.length ? images : [DEFAULT_IMG];
  const main = imgs[0];
  const rest = imgs.slice(1, 5);
  while (rest.length < 2) rest.push(main);
  return `
  <div class="gallery">
    <img class="g-main" src="${main}" alt="Photo principale">
    <img src="${rest[0]}" alt="Photo 2">
    <img src="${rest[1] || rest[0]}" alt="Photo 3">
    <img src="${rest[2] || rest[0]}" alt="Photo 4">
    <img src="${rest[3] || rest[0]}" alt="Photo 5">
  </div>`;
}

const AMENITY_ICONS = {
  'Wifi': '📶', 'Climatisation': '❄️', 'Télévision': '📺', 'Eau chaude': '🚿', 'Parking': '🅿️',
  'Petit-déjeuner': '🍳', 'Cuisine équipée': '🍳', 'Générateur': '🔌', 'Parking sécurisé': '🅿️',
  'Gardiennage 24h': '🛡️', 'Jardin': '🌿', 'Piscine privée': '🏊', 'Vue mer': '🌊', 'Vue montagne': '⛰️',
};

function starsHtml(rating) {
  const rounded = Math.round(rating);
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
}

async function loadRoom() {
  if (!roomId) { window.location.href = '/search.html'; return; }
  try {
    const { room, reviews } = await api(`/rooms/${roomId}`, { auth: false });
    currentRoom = room;
    document.title = `${room.title} — Roomia`;
    qs('breadcrumb').innerHTML = `<a href="/index.html">Accueil</a> › <a href="/search.html">Logements</a> › ${escapeHtml(room.city)}`;
    qs('gallery-wrap').innerHTML = galleryHtml(room.images);
    qs('r-title').textContent = room.title;
    qs('r-meta').textContent = `${room.city}, ${room.country} · ${room.capacity_adults} adultes · ${room.capacity_children} enfants · ${room.bedrooms} chambre(s) · ${room.beds} lit(s) · ${room.bathrooms} salle(s) de bain`;
    qs('r-desc').textContent = room.description || 'Aucune description fournie.';
    qs('r-rating').innerHTML = room.reviews_count > 0
      ? `<span style="color:var(--gold-deep);font-weight:700">${starsHtml(room.rating)} ${room.rating}</span> <span style="color:var(--muted-text)">(${room.reviews_count} avis)</span>`
      : `<span style="color:var(--muted-text)">Pas encore d'avis</span>`;
    qs('r-amenities').innerHTML = room.amenities.map(a => `<span class="amenity-chip">${AMENITY_ICONS[a] || '✓'} ${escapeHtml(a)}</span>`).join('') || '<p style="color:var(--muted-text)">Aucun équipement renseigné.</p>';

    qs('r-reviews').innerHTML = reviews.length
      ? reviews.map(r => `<div class="review-item">
          <div style="display:flex;justify-content:space-between"><strong>${escapeHtml(r.user_name)}</strong><span style="color:var(--gold-deep)">${starsHtml(r.rating)}</span></div>
          <p style="color:var(--muted-text);margin-top:6px">${escapeHtml(r.comment || '')}</p>
          <div style="font-size:12px;color:var(--muted-text);margin-top:4px">${formatDate(r.created_at)}</div>
        </div>`).join('')
      : `<div class="empty-state" style="padding:24px"><i>💬</i>Aucun avis pour l'instant.</div>`;

    qs('bw-price').textContent = money(room.price_per_night);
    qs('bw-rating').innerHTML = room.reviews_count > 0 ? `★ ${room.rating}` : '';

    if (Auth.isLoggedIn()) {
      const { rooms: favs } = await api('/favorites').catch(() => ({ rooms: [] }));
      if (favs.some(r => r.id === room.id)) qs('r-fav-btn').classList.add('active');
    }
  } catch (err) {
    qs('gallery-wrap').innerHTML = `<div class="empty-state"><i>⚠️</i>${escapeHtml(err.message)}</div>`;
  }
}

qs('r-fav-btn').addEventListener('click', async () => {
  if (!Auth.isLoggedIn()) { window.location.href = '/login.html'; return; }
  const btn = qs('r-fav-btn');
  const active = btn.classList.contains('active');
  try {
    if (active) { await api(`/favorites/${roomId}`, { method: 'DELETE' }); btn.classList.remove('active'); }
    else { await api('/favorites', { method: 'POST', body: { room_id: Number(roomId) } }); btn.classList.add('active'); }
  } catch (err) { showToast('Erreur', err.message, 'warn'); }
});

document.querySelectorAll('[data-adj]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = qs(btn.dataset.target);
    let val = Number(target.textContent) + Number(btn.dataset.adj);
    if (val < 1) val = 1;
    if (val > 20) val = 20;
    target.textContent = val;
    updateTotal();
  });
});

function nights() {
  const ci = qs('bw-checkin').value, co = qs('bw-checkout').value;
  if (!ci || !co) return 0;
  const n = Math.round((new Date(co) - new Date(ci)) / 86400000);
  return n > 0 ? n : 0;
}

async function updateTotal() {
  const n = nights();
  const availEl = qs('bw-availability');
  const totalEl = qs('bw-total');
  if (!currentRoom) return;
  if (n === 0) { totalEl.innerHTML = ''; availEl.innerHTML = ''; return; }

  totalEl.innerHTML = `<div style="display:flex;justify-content:space-between"><span>${money(currentRoom.price_per_night)} × ${n} nuit${n > 1 ? 's' : ''}</span><strong>${money(currentRoom.price_per_night * n)}</strong></div>`;

  try {
    const { available } = await api(`/rooms/${roomId}/availability?check_in=${qs('bw-checkin').value}&check_out=${qs('bw-checkout').value}`, { auth: false });
    availEl.innerHTML = available
      ? `<span style="color:var(--forest)">✓ Disponible sur ces dates</span>`
      : `<span style="color:var(--clay)">✖ Indisponible sur ces dates</span>`;
  } catch { availEl.innerHTML = ''; }
}
qs('bw-checkin').addEventListener('change', updateTotal);
qs('bw-checkout').addEventListener('change', updateTotal);

qs('bw-submit').addEventListener('click', async () => {
  if (!Auth.isLoggedIn()) { window.location.href = `/login.html?next=/room.html?id=${roomId}`; return; }
  const ci = qs('bw-checkin').value, co = qs('bw-checkout').value;
  if (!ci || !co) { showToast('Dates manquantes', 'Choisissez une date d\'arrivée et de départ.', 'warn'); return; }
  if (nights() <= 0) { showToast('Dates invalides', 'La date de départ doit être après l\'arrivée.', 'warn'); return; }

  const btn = qs('bw-submit');
  btn.disabled = true; btn.textContent = 'Réservation en cours…';
  try {
    const { booking } = await api('/bookings', {
      method: 'POST',
      body: { room_id: Number(roomId), check_in: ci, check_out: co, adults: Number(qs('bw-adults').textContent), travel_purpose: qs('bw-purpose').value },
    });
    window.location.href = `/checkout.html?booking=${booking.id}`;
  } catch (err) {
    showToast('Réservation impossible', err.message, 'warn');
    btn.disabled = false; btn.textContent = 'Réserver';
  }
});

loadRoom();
