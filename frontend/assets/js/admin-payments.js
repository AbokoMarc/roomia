mountAdminLayout('payments');

const METHOD_LABELS = { carte: 'Carte bancaire', paypal: 'PayPal', crypto: 'Crypto' };

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['pending', 'all', 'accounts'].forEach(t => qs(`tab-${t}`).classList.toggle('hidden', t !== btn.dataset.tab));
  });
});

async function loadPending() {
  try {
    const { payments } = await api('/admin/payments');
    const pending = payments.filter(p => p.status === 'en_attente');
    qs('pending-tbody').innerHTML = pending.length ? pending.map(p => `
      <tr data-id="${p.id}">
        <td data-label="Réservation"><strong>${p.booking_code}</strong></td>
        <td data-label="Client">${escapeHtml(p.client_name)}<div style="font-size:12px;color:var(--muted-text)">${escapeHtml(p.client_email)}</div></td>
        <td data-label="Méthode">${METHOD_LABELS[p.method] || p.method}${p.provider ? ` (${p.provider.toUpperCase()})` : ''}</td>
        <td data-label="Montant">${Math.round(p.amount)} €</td>
        <td data-label="Référence" style="max-width:220px;word-break:break-all;font-size:12px">${escapeHtml(p.reference || p.proof || '—')}</td>
        <td class="row-actions">
          <button class="btn btn-primary btn-sm" data-validate="${p.id}">Valider</button>
          <button class="btn btn-danger btn-sm" data-reject="${p.id}">Rejeter</button>
        </td>
      </tr>`).join('') : `<tr><td colspan="6" style="padding:30px;text-align:center;color:var(--muted-text)">Aucun paiement en attente de vérification. 🎉</td></tr>`;

    qs('all-tbody').innerHTML = payments.map(p => `
      <tr><td data-label="Réservation"><strong>${p.booking_code}</strong></td><td data-label="Client">${escapeHtml(p.client_name)}</td>
        <td data-label="Méthode">${METHOD_LABELS[p.method] || p.method}</td><td data-label="Montant">${Math.round(p.amount)} €</td>
        <td data-label="Statut"><span class="badge badge-${p.status}">${p.status.replace('_', ' ')}</span></td>
        <td data-label="Date" style="font-size:12px">${formatDate(p.created_at)}</td></tr>`).join('');
  } catch (err) { showToast('Erreur', err.message, 'warn'); }
}

qs('pending-tbody').addEventListener('click', async (e) => {
  const validateId = e.target.dataset.validate;
  const rejectId = e.target.dataset.reject;
  if (validateId) {
    if (!confirm('Confirmer la validation de ce paiement ? La réservation sera automatiquement confirmée.')) return;
    try { await api(`/admin/payments/${validateId}/validate`, { method: 'PUT', body: {} }); showToast('Validé', 'Paiement confirmé, client notifié.', 'success'); loadPending(); }
    catch (err) { showToast('Erreur', err.message, 'warn'); }
  }
  if (rejectId) {
    const note = prompt('Motif du rejet (visible par le client) :');
    if (note === null) return;
    try { await api(`/admin/payments/${rejectId}/reject`, { method: 'PUT', body: { admin_note: note } }); showToast('Rejeté', 'Le client a été notifié.', 'warn'); loadPending(); }
    catch (err) { showToast('Erreur', err.message, 'warn'); }
  }
});

async function loadAccounts() {
  try {
    const { accounts } = await api('/admin/payout-accounts');
    const byMethod = Object.fromEntries(accounts.map(a => [a.method, a]));
    const methods = ['crypto', 'carte', 'paypal'];
    qs('accounts-list').innerHTML = methods.map(m => {
      const a = byMethod[m] || {};
      return `
      <div class="account-card">
        <h4>${m === 'crypto' ? '₿ Crypto (Binance)' : METHOD_LABELS[m]}</h4>
        <form data-method="${m}" class="account-form">
          <div class="field-row" style="margin-top:10px">
            <div class="field"><label>Libellé</label><input type="text" name="label" value="${escapeHtml(a.label || '')}"></div>
            <div class="field"><label>Destination (adresse / IBAN / email)</label><input type="text" name="destination" value="${escapeHtml(a.destination || '')}"></div>
          </div>
          <div class="field"><label>Note de reversement</label><textarea name="settlement_note" rows="2">${escapeHtml(a.settlement_note || '')}</textarea></div>
          <label style="font-size:13px;display:flex;align-items:center;gap:8px;margin-bottom:10px"><input type="checkbox" name="active" style="width:auto" ${a.active ? 'checked' : ''}> Méthode active (visible au checkout)</label>
          <button type="submit" class="btn btn-dark btn-sm">Enregistrer</button>
        </form>
      </div>`;
    }).join('');

    document.querySelectorAll('.account-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        try {
          await api('/admin/payout-accounts', {
            method: 'PUT',
            body: {
              method: form.dataset.method,
              label: fd.get('label'),
              destination: fd.get('destination'),
              settlement_note: fd.get('settlement_note'),
              active: fd.get('active') === 'on',
            },
          });
          showToast('Enregistré', 'Compte de destination mis à jour.', 'success');
        } catch (err) { showToast('Erreur', err.message, 'warn'); }
      });
    });
  } catch (err) { showToast('Erreur', err.message, 'warn'); }
}

loadPending();
loadAccounts();
