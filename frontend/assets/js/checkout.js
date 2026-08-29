if (!requireAuthOrRedirect()) { /* redirection en cours */ }

const bookingId = new URLSearchParams(window.location.search).get('booking');
const payReturn = new URLSearchParams(window.location.search).get('pay'); // 'return' | 'cancel' | null
let currentBooking = null;
let selectedMethod = null;
let cryptoAuto = false;

async function loadMethodsAvailability() {
  try {
    const { paypal_enabled, crypto_auto } = await api('/payments/methods', { auth: false });
    qs('paypal-method').classList.toggle('hidden', !paypal_enabled);
    cryptoAuto = !!crypto_auto;
    qs('crypto-auto-info').classList.toggle('hidden', !cryptoAuto);
    qs('crypto-manual-fields').classList.toggle('hidden', cryptoAuto);
  } catch { /* silencieux — par défaut : PayPal caché, crypto en manuel */ }
}

async function loadNeeroAccount() {
  try {
    const { account } = await api('/payments/neero-account', { auth: false });
    qs('neero-destination').innerHTML = account?.account_number
      ? `Compte : <strong style="word-break:break-all">${escapeHtml(account.account_name || 'Neero')} — ${escapeHtml(account.account_number)}</strong>${account.note ? `<div style="margin-top:6px;color:var(--muted-text)">${escapeHtml(account.note)}</div>` : ''}`
      : `<span style="color:var(--muted-text)">Compte à configurer par l'administrateur.</span>`;
  } catch { /* silencieux */ }
}

async function loadCryptoWallet() {
  try {
    const { wallet } = await api('/payments/crypto-wallet', { auth: false });
    qs('crypto-destination').innerHTML = wallet?.address
      ? `Adresse wallet : <strong style="word-break:break-all">${escapeHtml(wallet.address)}</strong>${wallet.network_note ? `<div style="margin-top:6px;color:var(--muted-text)">${escapeHtml(wallet.network_note)}</div>` : ''}`
      : `<span style="color:var(--muted-text)">Adresse wallet à configurer par l'administrateur.</span>`;
  } catch { /* silencieux */ }
}

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
    const labels = { carte: 'Envoyer via Neero', paypal: 'Continuer avec PayPal', crypto: cryptoAuto ? 'Payer en crypto' : 'Envoyer le paiement' };
    qs('pay-submit').textContent = labels[selectedMethod];
  });
});

async function submitManualPayment(method, reference, provider) {
  const btn = qs('pay-submit');
  const errEl = qs('checkout-error');
  btn.disabled = true; const originalText = btn.textContent; btn.textContent = 'Envoi…';
  try {
    await api('/payments', { method: 'POST', body: { booking_id: currentBooking.id, method, provider, reference } });
    showToast('Paiement envoyé', 'Ton paiement est en cours de vérification. Tu recevras une notification dès confirmation.', 'success');
    setTimeout(() => { window.location.href = '/dashboard.html'; }, 1800);
  } catch (err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = originalText;
  }
}

async function redirectToCheckout(endpoint) {
  const btn = qs('pay-submit');
  const errEl = qs('checkout-error');
  btn.disabled = true; const originalText = btn.textContent; btn.textContent = 'Redirection…';
  try {
    const { url } = await api(endpoint, { method: 'POST', body: { booking_id: currentBooking.id } });
    window.location.href = url;
  } catch (err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = originalText;
  }
}

qs('pay-submit').addEventListener('click', async () => {
  const errEl = qs('checkout-error');
  errEl.style.display = 'none';
  if (!selectedMethod) { errEl.textContent = 'Choisissez une méthode de paiement.'; errEl.style.display = 'block'; return; }
  if (!currentBooking || currentBooking.status !== 'en_attente') return;

  if (selectedMethod === 'carte') { // Neero — virement manuel
    const reference = qs('neero-reference').value.trim();
    if (!reference) { errEl.textContent = 'Merci de renseigner la référence du virement.'; errEl.style.display = 'block'; return; }
    return submitManualPayment('carte', reference, 'neero');
  }

  if (selectedMethod === 'crypto') {
    if (cryptoAuto) return redirectToCheckout('/payments/binancepay/create-checkout');
    const hash = qs('crypto-hash').value.trim();
    if (!hash) { errEl.textContent = 'Merci de renseigner le hash de la transaction.'; errEl.style.display = 'block'; return; }
    return submitManualPayment('crypto', hash, qs('crypto-currency').value);
  }

  if (selectedMethod === 'paypal') return redirectToCheckout('/payments/paypal/create-checkout');
});

mountLayout();
loadSummary();
loadMethodsAvailability();
loadNeeroAccount();
loadCryptoWallet();
