if (!requireAuthOrRedirect()) { /* redirection en cours */ }

const bookingId = new URLSearchParams(window.location.search).get('booking');
const payReturn = new URLSearchParams(window.location.search).get('pay'); // 'return' | 'cancel' | null
let currentBooking = null;
let selectedMethod = null;

const CREATE_CHECKOUT_ENDPOINT = {
  carte: '/payments/flutterwave/create-checkout',
  paypal: '/payments/paypal/create-checkout',
  crypto: '/payments/crypto/create-checkout',
};

async function loadSummary() {
  try {
    const { bookings } = await api('/bookings/mine');
    const booking = bookings.find(b => b.id === Number(bookingId));
    if (!booking) { qs('summary-card').innerHTML = `<div class="empty-state"><i>⚠️</i>Réservation introuvable.</div>`; return; }
    currentBooking = booking;

    // Retour depuis une gateway : le webhook peut prendre 1-2 secondes — on affiche un état d'attente
    // et on rafraîchit automatiquement jusqu'à ce que le statut change (la notification temps réel confirmera aussi).
    if (payReturn === 'return' && booking.status === 'en_attente') {
      qs('summary-card').innerHTML = `<div style="text-align:center;padding:20px">
        <div class="spinner"></div>
        <h3 style="margin-top:10px">Confirmation du paiement…</h3>
        <p style="color:var(--muted-text);font-size:14px;margin-top:6px">Ça ne prend que quelques secondes.</p>
      </div>`;
      qs('pay-submit').classList.add('hidden');
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const { bookings: fresh } = await api('/bookings/mine').catch(() => ({ bookings: [] }));
        const updated = fresh.find(b => b.id === Number(bookingId));
        if (updated && updated.status !== 'en_attente') {
          clearInterval(poll);
          currentBooking = updated;
          renderSummary(updated);
        } else if (attempts > 15) {
          clearInterval(poll); // au-delà de ~30s, la notification en temps réel prendra le relais
        }
      }, 2000);
      return;
    }

    if (payReturn === 'cancel') {
      showToast('Paiement annulé', 'Tu peux réessayer avec la même méthode ou en choisir une autre.', 'warn');
    }

    renderSummary(booking);
  } catch (err) {
    qs('summary-card').innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function renderSummary(booking) {
  if (booking.status !== 'en_attente') {
    qs('summary-card').innerHTML = `<div style="text-align:center;padding:20px">
      <div style="font-size:36px">${booking.status === 'confirmee' ? '✅' : 'ℹ️'}</div>
      <h3 style="margin-top:10px">Réservation ${booking.status.replace('_', ' ')}</h3>
      <p style="color:var(--muted-text);font-size:14px;margin-top:6px">Code : ${booking.code}</p>
      <a href="/dashboard.html" class="btn btn-dark btn-block" style="margin-top:16px">Voir mes réservations</a>
    </div>`;
    qs('pay-submit').classList.remove('hidden');
    qs('pay-submit').disabled = true;
    qs('pay-submit').textContent = 'Réservation déjà traitée';
    return;
  }

  qs('summary-card').innerHTML = `
    <img src="${booking.room.images[0] || ''}" style="width:100%;height:150px;object-fit:cover;border-radius:var(--radius-sm);margin-bottom:14px">
    <h3 style="font-size:17px">${escapeHtml(booking.room.title)}</h3>
    <p style="color:var(--muted-text);font-size:13px;margin:4px 0 14px">${escapeHtml(booking.room.city)}</p>
    <div style="font-size:14px;display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line);padding-top:14px">
      <div style="display:flex;justify-content:space-between"><span>Arrivée</span><strong>${formatDate(booking.check_in)}</strong></div>
      <div style="display:flex;justify-content:space-between"><span>Départ</span><strong>${formatDate(booking.check_out)}</strong></div>
      <div style="display:flex;justify-content:space-between"><span>Voyageurs</span><strong>${booking.adults} adultes</strong></div>
      <div style="display:flex;justify-content:space-between"><span>${booking.nights} nuit(s) × ${money(booking.price_per_night)}</span><strong>${money(booking.total_price)}</strong></div>
    </div>
    <div style="border-top:1px dashed var(--line);margin-top:14px;padding-top:14px;display:flex;justify-content:space-between;font-size:16px">
      <strong>Total</strong><strong>${money(booking.total_price)}</strong>
    </div>
    <div style="margin-top:10px"><span class="badge badge-attente">Code : ${booking.code}</span></div>
  `;
}

document.querySelectorAll('.pay-method').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.pay-method').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    selectedMethod = el.dataset.method;
    const labels = { carte: 'Payer par carte', paypal: 'Continuer avec PayPal', crypto: 'Payer en crypto' };
    qs('pay-submit').textContent = labels[selectedMethod];
  });
});

// Les 3 méthodes fonctionnent de façon identique désormais : on crée une session chez la gateway,
// puis on redirige le navigateur vers sa page de paiement hébergée. Le webhook confirme ensuite tout seul.
qs('pay-submit').addEventListener('click', async () => {
  const errEl = qs('checkout-error');
  errEl.style.display = 'none';
  if (!selectedMethod) { errEl.textContent = 'Choisissez une méthode de paiement.'; errEl.style.display = 'block'; return; }
  if (!currentBooking || currentBooking.status !== 'en_attente') return;

  const btn = qs('pay-submit');
  btn.disabled = true; const originalText = btn.textContent; btn.textContent = 'Redirection…';

  try {
    const { url } = await api(CREATE_CHECKOUT_ENDPOINT[selectedMethod], { method: 'POST', body: { booking_id: currentBooking.id } });
    window.location.href = url;
  } catch (err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = originalText;
  }
});

mountLayout();
loadSummary();
