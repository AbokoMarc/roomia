mountAdminLayout('payments');

const METHOD_LABELS = { carte: 'Carte bancaire', paypal: 'PayPal', crypto: 'Crypto' };

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['pending', 'all', 'wallet'].forEach(t => qs(`tab-${t}`).classList.toggle('hidden', t !== btn.dataset.tab));
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
        <td data-label="Méthode">${METHOD_LABELS[p.method] || p.method}${p.provider ? ` (${p.provider})` : ''}</td>
        <td data-label="Montant">${Math.round(p.amount)} €</td>
        <td data-label="Référence" style="max-width:220px;word-break:break-all;font-size:12px">${escapeHtml(p.reference || '—')}</td>
        <td class="row-actions">
          <button class="btn btn-primary btn-sm" data-validate="${p.id}">Valider</button>
          <button class="btn btn-danger btn-sm" data-reject="${p.id}">Rejeter</button>
        </td>
      </tr>`).join('') : `<tr><td colspan="6" style="padding:30px;text-align:center;color:var(--muted-text)">Aucun paiement en attente. 🎉 (normal : tout se valide automatiquement)</td></tr>`;

    qs('all-tbody').innerHTML = payments.map(p => `
      <tr><td data-label="Réservation"><strong>${p.booking_code}</strong></td><td data-label="Client">${escapeHtml(p.client_name)}</td>
        <td data-label="Méthode">${METHOD_LABELS[p.method] || p.method}${p.provider ? ` (${p.provider})` : ''}</td><td data-label="Montant">${Math.round(p.amount)} €</td>
        <td data-label="Statut"><span class="badge badge-${p.status}">${p.status.replace('_', ' ')}</span></td>
        <td data-label="Date" style="font-size:12px">${formatDate(p.created_at)}</td></tr>`).join('');
  } catch (err) { showToast('Erreur', err.message, 'warn'); }
}

qs('pending-tbody').addEventListener('click', async (e) => {
  const validateId = e.target.dataset.validate;
  const rejectId = e.target.dataset.reject;
  if (validateId) {
    if (!confirm('Confirme que tu as bien vérifié cette transaction (explorateur blockchain ou tableau de bord de la gateway) avant de valider. Continuer ?')) return;
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

async function loadWallet() {
  try {
    const { wallet } = await api('/admin/crypto-wallet');
    qs('wallet-address').value = wallet?.address || '';
    qs('wallet-note').value = wallet?.network_note || '';
  } catch (err) { showToast('Erreur', err.message, 'warn'); }
}

qs('wallet-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/admin/crypto-wallet', { method: 'PUT', body: { address: qs('wallet-address').value.trim(), network_note: qs('wallet-note').value.trim() } });
    showToast('Enregistré', 'Le wallet affiché aux clients a été mis à jour.', 'success');
  } catch (err) { showToast('Erreur', err.message, 'warn'); }
});

loadPending();
loadWallet();
