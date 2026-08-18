if (!requireAuthOrRedirect()) { /* redirection en cours */ }
mountLayout('dashboard');

const STATUS_LABELS = { en_attente: 'En attente de paiement', confirmee: 'Confirmée', annulee: 'Annulée', terminee: 'Terminée' };

function bookingRowHtml(b) {
  const img = b.room?.images?.[0] || '';
  return `
  <div style="background:white;border-radius:var(--radius-md);box-shadow:var(--shadow-card);padding:18px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">
    <img src="${img}" style="width:90px;height:90px;object-fit:cover;border-radius:var(--radius-sm);flex-shrink:0">
    <div style="flex:1;min-width:200px">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <strong>${escapeHtml(b.room?.title || 'Logement supprimé')}</strong>
        <span class="badge badge-${b.status}">${STATUS_LABELS[b.status]}</span>
      </div>
      <p style="color:var(--muted-text);font-size:13px;margin:6px 0">${formatDate(b.check_in)} → ${formatDate(b.check_out)} · ${b.nights} nuit(s) · ${b.adults} adultes</p>
      <p style="font-size:13px">Code : <strong>${b.code}</strong> · ${money(b.total_price)}</p>
      ${b.payment ? `<p style="font-size:12px;color:var(--muted-text)">Paiement : ${b.payment.method.replace('_', ' ')} — <span class="badge badge-${b.payment.status}">${b.payment.status}</span></p>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${b.status === 'en_attente' && !b.payment ? `<a href="/checkout.html?booking=${b.id}" class="btn btn-primary btn-sm">Payer</a>` : ''}
      ${['en_attente', 'confirmee'].includes(b.status) ? `<button class="btn btn-ghost btn-sm" onclick="cancelBooking(${b.id})">Annuler</button>` : ''}
      ${b.status === 'terminee' ? `<button class="btn btn-outline-ink btn-sm" onclick="openReview(${b.room?.id}, ${b.id})">Laisser un avis</button>` : ''}
    </div>
  </div>`;
}

async function loadBookings() {
  try {
    const { bookings } = await api('/bookings/mine');
    qs('bookings-list').innerHTML = bookings.length
      ? bookings.map(bookingRowHtml).join('')
      : `<div class="empty-state"><i>🧳</i>Vous n'avez pas encore de réservation. <a href="/search.html" style="color:var(--ink);font-weight:600">Explorer les logements</a></div>`;
  } catch (err) {
    qs('bookings-list').innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function cancelBooking(id) {
  if (!confirm('Annuler cette réservation ?')) return;
  try { await api(`/bookings/${id}/cancel`, { method: 'PUT' }); showToast('Réservation annulée', '', 'warn'); loadBookings(); }
  catch (err) { showToast('Erreur', err.message, 'warn'); }
}

function openReview(roomId, bookingId) {
  const rating = prompt('Note sur 5 (1 à 5) :', '5');
  if (!rating) return;
  const comment = prompt('Votre commentaire :', '');
  api('/reviews', { method: 'POST', body: { room_id: roomId, booking_id: bookingId, rating: Number(rating), comment } })
    .then(() => showToast('Merci !', 'Votre avis a été publié.', 'success'))
    .catch(err => showToast('Erreur', err.message, 'warn'));
}

async function loadFavoris() {
  try {
    const { rooms } = await api('/favorites');
    const DEFAULT_IMG = 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=600';
    qs('favoris-grid').innerHTML = rooms.length
      ? rooms.map(room => `
        <a href="/room.html?id=${room.id}" class="room-card">
          <div class="room-img-wrap"><img src="${room.images[0] || DEFAULT_IMG}"><span class="room-type-tag">${room.type}</span></div>
          <div class="room-body"><h3>${escapeHtml(room.title)}</h3><div class="room-meta">${escapeHtml(room.city)}</div>
          <div class="room-price"><span class="amount">${money(room.price_per_night)}</span><span class="per-night">/ nuit</span></div></div>
        </a>`).join('')
      : `<div class="empty-state" style="grid-column:1/-1"><i>♥</i>Aucun favori pour l'instant.</div>`;
  } catch (err) {
    qs('favoris-grid').innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function loadProfile() {
  const user = Auth.getUser();
  qs('p-name').value = user.name || '';
  qs('p-phone').value = user.phone || '';
}

qs('p-save').addEventListener('click', async () => {
  try {
    const { user } = await api('/auth/me', { method: 'PUT', body: { name: qs('p-name').value, phone: qs('p-phone').value } });
    Auth.setUser(user);
    showToast('Profil mis à jour', '', 'success');
  } catch (err) { showToast('Erreur', err.message, 'warn'); }
});

qs('p-change-pass').addEventListener('click', async () => {
  const errEl = qs('p-pass-error');
  errEl.style.display = 'none';
  try {
    await api('/auth/change-password', { method: 'PUT', body: { current_password: qs('p-current').value, new_password: qs('p-new').value } });
    qs('p-current').value = ''; qs('p-new').value = '';
    showToast('Mot de passe modifié', '', 'success');
  } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['bookings', 'favoris', 'profil'].forEach(t => qs(`tab-${t}`).classList.toggle('hidden', t !== btn.dataset.tab));
    if (btn.dataset.tab === 'favoris') loadFavoris();
  });
});

if (window.location.hash === '#favoris') qs('favoris-tab-btn').click();

loadBookings();
loadProfile();
