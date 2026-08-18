mountAdminLayout('users');

let pendingAction = null; // { type: 'view' | 'reset', userId }
let currentDetailUserId = null;

const DOC_LABELS = { carte_identite: "Carte d'identité", passeport: 'Passeport', permis_conduire: 'Permis de conduire' };
const PURPOSE_LABELS = { loisirs: 'Loisirs', travail: 'Travail', etudes: 'Études', autre: 'Autre' };

async function loadUsers() {
  try {
    const { users } = await api('/admin/users');
    qs('users-tbody').innerHTML = users.filter(u => u.role === 'client').map(u => `
      <tr data-id="${u.id}">
        <td><strong>${escapeHtml(u.name)}</strong></td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.phone || '—')}</td>
        <td>${u.loyalty_points}</td>
        <td style="font-size:12px">${formatDate(u.created_at)}</td>
        <td><button class="btn btn-ghost btn-sm" data-view="${u.id}">Voir les détails</button></td>
      </tr>`).join('') || `<tr><td colspan="6" style="padding:30px;text-align:center;color:var(--muted-text)">Aucun client inscrit pour l'instant.</td></tr>`;
  } catch (err) { showToast('Erreur', err.message, 'warn'); }
}

qs('users-tbody').addEventListener('click', (e) => {
  const userId = e.target.dataset.view;
  if (!userId) return;
  pendingAction = { type: 'view', userId };
  openReauth();
});

function openReauth() {
  qs('reauth-password').value = '';
  qs('reauth-error').style.display = 'none';
  qs('reauth-overlay').classList.remove('hidden');
  setTimeout(() => qs('reauth-password').focus(), 50);
}
qs('reauth-close').addEventListener('click', () => { qs('reauth-overlay').classList.add('hidden'); pendingAction = null; });

qs('reauth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = qs('reauth-password').value;
  const errEl = qs('reauth-error');
  if (!pendingAction) return;
  try {
    if (pendingAction.type === 'view') {
      const { user } = await api(`/admin/users/${pendingAction.userId}/sensitive`, { method: 'POST', body: { admin_password: password } });
      currentDetailUserId = user.id;
      qs('detail-body').innerHTML = `
        <div><strong>Nom complet</strong>${escapeHtml(user.name)}</div>
        <div><strong>Email</strong>${escapeHtml(user.email)}</div>
        <div><strong>Téléphone</strong>${escapeHtml(user.phone || '—')}</div>
        <div><strong>Adresse</strong>${escapeHtml(user.address || '—')}</div>
        <div><strong>Ville</strong>${escapeHtml(user.city || '—')}</div>
        <div><strong>Code postal</strong>${escapeHtml(user.postal_code || '—')}</div>
        <div><strong>Pays</strong>${escapeHtml(user.country || '—')}</div>
        <div><strong>Date de naissance</strong>${user.date_of_birth ? formatDate(user.date_of_birth) : '—'}</div>
        <div><strong>Nationalité</strong>${escapeHtml(user.nationality || '—')}</div>
        <div><strong>Pièce d'identité</strong>${DOC_LABELS[user.id_document_type] || '—'}</div>
        <div><strong>N° de pièce</strong>${escapeHtml(user.id_document_number || '—')}</div>
        <div><strong>Motif de voyage habituel</strong>${PURPOSE_LABELS[user.default_travel_purpose] || '—'}</div>
        <div><strong>Langue</strong>${(user.preferred_language || 'fr').toUpperCase()}</div>
        <div><strong>Points fidélité</strong>${user.loyalty_points}</div>
        <div><strong>Réservations</strong>${user.bookings_count}</div>
        <div><strong>Inscrit le</strong>${formatDate(user.created_at)}</div>
      `;
      qs('reauth-overlay').classList.add('hidden');
      qs('detail-overlay').classList.remove('hidden');
    } else if (pendingAction.type === 'reset') {
      const { temp_password } = await api(`/admin/users/${pendingAction.userId}/reset-password`, { method: 'POST', body: { admin_password: password } });
      qs('reauth-overlay').classList.add('hidden');
      qs('temp-pwd-value').textContent = temp_password;
      qs('temp-pwd-overlay').classList.remove('hidden');
    }
    pendingAction = null;
  } catch (err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
  }
});

qs('detail-close').addEventListener('click', () => qs('detail-overlay').classList.add('hidden'));

qs('reset-pwd-btn').addEventListener('click', () => {
  qs('detail-overlay').classList.add('hidden');
  pendingAction = { type: 'reset', userId: currentDetailUserId };
  openReauth();
});

qs('temp-pwd-close').addEventListener('click', () => qs('temp-pwd-overlay').classList.add('hidden'));

loadUsers();
