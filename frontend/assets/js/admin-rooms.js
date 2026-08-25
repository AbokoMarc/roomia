mountAdminLayout('rooms');

let allRooms = [];

function statusBadgeHtml(status) {
  return status === 'disponible'
    ? `<button class="status-toggle badge-confirmee" data-toggle="${status}">Disponible</button>`
    : `<button class="status-toggle badge-annulee" data-toggle="${status}">Indisponible</button>`;
}

function rowHtml(r) {
  const img = r.images[0] || 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=200';
  return `
  <tr data-id="${r.id}">
    <td class="td-nolabel"><img class="thumb" src="${img}" alt=""></td>
    <td data-label="Titre"><strong>${escapeHtml(r.title)}</strong></td>
    <td data-label="Ville / Pays">${escapeHtml(r.city)}, ${escapeHtml(r.country || '')}</td>
    <td data-label="Type" style="text-transform:capitalize">${r.type}</td>
    <td data-label="Prix / nuit">${Math.round(r.price_per_night)} €</td>
    <td data-label="Statut">${statusBadgeHtml(r.status)}</td>
    <td class="row-actions">
      <button class="btn btn-ghost btn-sm" data-edit="${r.id}">Modifier</button>
      <button class="btn btn-danger btn-sm" data-delete="${r.id}">Supprimer</button>
    </td>
  </tr>`;
}

async function loadRooms() {
  try {
    const { rooms } = await api('/admin/rooms');
    allRooms = rooms;
    qs('rooms-tbody').innerHTML = rooms.length
      ? rooms.map(rowHtml).join('')
      : `<tr><td colspan="7" style="padding:30px;text-align:center;color:var(--muted-text)">Aucun logement. Ajoute le premier !</td></tr>`;
  } catch (err) {
    qs('rooms-tbody').innerHTML = `<tr><td colspan="7" style="padding:20px;color:var(--clay)">${escapeHtml(err.message)}</td></tr>`;
  }
}

function openModal(room = null) {
  qs('room-form').reset();
  qs('room-modal-title').textContent = room ? 'Modifier le logement' : 'Ajouter un logement';
  qs('rm-id').value = room?.id || '';
  qs('rm-title').value = room?.title || '';
  qs('rm-type').value = room?.type || 'chambre';
  qs('rm-status').value = room?.status || 'disponible';
  qs('rm-city').value = room?.city || '';
  qs('rm-country').value = room?.country || 'France';
  qs('rm-address').value = room?.address || '';
  qs('rm-lat').value = room?.latitude ?? '';
  qs('rm-lng').value = room?.longitude ?? '';
  qs('rm-desc').value = room?.description || '';
  qs('rm-price').value = room?.price_per_night ?? '';
  qs('rm-adults').value = room?.capacity_adults ?? 2;
  qs('rm-children').value = room?.capacity_children ?? 0;
  qs('rm-bedrooms').value = room?.bedrooms ?? 1;
  qs('rm-beds').value = room?.beds ?? 1;
  qs('rm-bathrooms').value = room?.bathrooms ?? 1;
  qs('rm-amenities').value = (room?.amenities || []).join(', ');
  qs('rm-images').value = (room?.images || []).join('\n');
  qs('rm-featured').checked = !!room?.featured;
  qs('room-form-error').style.display = 'none';
  qs('room-modal-overlay').classList.remove('hidden');
}
function closeModal() { qs('room-modal-overlay').classList.add('hidden'); }

qs('new-room-btn').addEventListener('click', () => openModal());
qs('room-modal-close').addEventListener('click', closeModal);
qs('room-modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'room-modal-overlay') closeModal(); });

qs('rooms-tbody').addEventListener('click', async (e) => {
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.delete;
  const toggleStatus = e.target.dataset.toggle;

  if (editId) openModal(allRooms.find(r => r.id === Number(editId)));

  if (delId) {
    if (!confirm('Supprimer définitivement ce logement ?')) return;
    try { await api(`/rooms/${delId}`, { method: 'DELETE' }); showToast('Supprimé', 'Le logement a été retiré du catalogue.', 'success'); loadRooms(); }
    catch (err) { showToast('Impossible de supprimer', err.message, 'warn'); }
  }

  if (toggleStatus) {
    const tr = e.target.closest('tr');
    const id = tr.dataset.id;
    const newStatus = toggleStatus === 'disponible' ? 'indisponible' : 'disponible';
    try { await api(`/rooms/${id}`, { method: 'PUT', body: { status: newStatus } }); loadRooms(); }
    catch (err) { showToast('Erreur', err.message, 'warn'); }
  }
});

qs('room-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = qs('rm-id').value;
  const errEl = qs('room-form-error');
  errEl.style.display = 'none';
  const body = {
    title: qs('rm-title').value.trim(),
    type: qs('rm-type').value,
    status: qs('rm-status').value,
    city: qs('rm-city').value.trim(),
    country: qs('rm-country').value.trim(),
    address: qs('rm-address').value.trim(),
    latitude: qs('rm-lat').value ? Number(qs('rm-lat').value) : null,
    longitude: qs('rm-lng').value ? Number(qs('rm-lng').value) : null,
    description: qs('rm-desc').value.trim(),
    price_per_night: Number(qs('rm-price').value),
    capacity_adults: Number(qs('rm-adults').value),
    capacity_children: Number(qs('rm-children').value),
    bedrooms: Number(qs('rm-bedrooms').value),
    beds: Number(qs('rm-beds').value),
    bathrooms: Number(qs('rm-bathrooms').value),
    amenities: qs('rm-amenities').value.split(',').map(s => s.trim()).filter(Boolean),
    images: qs('rm-images').value.split('\n').map(s => s.trim()).filter(Boolean),
    featured: qs('rm-featured').checked,
  };
  const btn = qs('room-form-submit');
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  try {
    if (id) await api(`/rooms/${id}`, { method: 'PUT', body });
    else await api('/rooms', { method: 'POST', body });
    showToast('Enregistré', 'Le logement a été sauvegardé avec succès.', 'success');
    closeModal(); loadRooms();
  } catch (err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
  } finally { btn.disabled = false; btn.textContent = 'Enregistrer'; }
});

loadRooms();
