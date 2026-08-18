mountAdminLayout('bookings');

let allBookings = [];
let activeStatus = '';

function statusBadge(status) {
  const labels = { en_attente: 'En attente', confirmee: 'Confirmée', annulee: 'Annulée', terminee: 'Terminée' };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

function rowHtml(b) {
  return `
  <tr data-id="${b.id}">
    <td><strong>${b.code}</strong></td>
    <td>${escapeHtml(b.client_name)}<div style="font-size:12px;color:var(--muted-text)">${escapeHtml(b.client_email)}</div></td>
    <td>${escapeHtml(b.room?.title || '—')}</td>
    <td>${formatDate(b.check_in)} → ${formatDate(b.check_out)}<div style="font-size:12px;color:var(--muted-text)">${b.nights} nuit(s)</div></td>
    <td>${Math.round(b.total_price)} €</td>
    <td>${statusBadge(b.status)}</td>
    <td class="row-actions">
      ${b.status === 'en_attente' ? `<button class="btn btn-ghost btn-sm" data-status-set="confirmee">Confirmer</button>` : ''}
      ${b.status === 'confirmee' ? `<button class="btn btn-ghost btn-sm" data-status-set="terminee">Terminer</button>` : ''}
      ${b.status !== 'annulee' && b.status !== 'terminee' ? `<button class="btn btn-danger btn-sm" data-status-set="annulee">Annuler</button>` : ''}
    </td>
  </tr>`;
}

async function loadBookings() {
  try {
    const { bookings } = await api('/admin/bookings');
    allBookings = bookings;
    renderTable();
  } catch (err) {
    qs('bookings-tbody').innerHTML = `<tr><td colspan="7" style="padding:20px;color:var(--clay)">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderTable() {
  const list = activeStatus ? allBookings.filter(b => b.status === activeStatus) : allBookings;
  qs('bookings-tbody').innerHTML = list.length
    ? list.map(rowHtml).join('')
    : `<tr><td colspan="7" style="padding:30px;text-align:center;color:var(--muted-text)">Aucune réservation dans cette catégorie.</td></tr>`;
}

document.querySelectorAll('#status-tabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#status-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeStatus = btn.dataset.status;
    renderTable();
  });
});

qs('bookings-tbody').addEventListener('click', async (e) => {
  const newStatus = e.target.dataset.statusSet;
  if (!newStatus) return;
  const id = e.target.closest('tr').dataset.id;
  if (newStatus === 'annulee' && !confirm('Confirmer l\'annulation de cette réservation ?')) return;
  try {
    await api(`/admin/bookings/${id}/status`, { method: 'PUT', body: { status: newStatus } });
    showToast('Mis à jour', 'Le statut de la réservation a été modifié.', 'success');
    loadBookings();
  } catch (err) { showToast('Erreur', err.message, 'warn'); }
});

loadBookings();
