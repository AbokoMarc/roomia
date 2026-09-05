// Liste informative des moyens de paiement pour les transactions immobilières (achat/location) —
// affichage uniquement, ces méthodes ne sont pas intégrées techniquement (traitées de gré à gré avec le client,
// contrairement au paiement crypto des réservations courtes qui est le seul moyen réellement automatisé sur Roomia).
const PAYMENT_METHODS = [
  { icon: '💳', label: 'Carte bancaire' },
  { icon: '🏦', label: 'Virement SEPA' },
  { icon: '⚡', label: 'Virement instantané' },
  { icon: '📱', label: 'Paiement mobile' },
  { icon: '🔵', label: 'Wero' },
  { icon: '🔄', label: 'Prélèvement SEPA' },
  { icon: '📝', label: 'Chèque' },
  { icon: '💶', label: 'Espèces' },
  { icon: '💻', label: 'Monnaie électronique' },
];

function renderPaymentIconsBar(compact = false) {
  const items = PAYMENT_METHODS.map(m => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:64px">
      <span style="font-size:${compact ? '20px' : '24px'}">${m.icon}</span>
      <span style="font-size:11px;color:var(--muted-text);text-align:center;line-height:1.2">${m.label}</span>
    </div>`).join('');
  return `<div style="display:flex;flex-wrap:wrap;gap:18px;justify-content:center;padding:${compact ? '14px' : '20px'} 12px">${items}</div>`;
}

function mountAdminPaymentIconsBar() {
  const bar = document.createElement('div');
  bar.style.cssText = 'background:var(--sand-deep);border-top:1px solid var(--line);margin-top:40px';
  bar.innerHTML = `
    <div class="container" style="padding-top:10px">
      <p style="text-align:center;font-size:12px;color:var(--muted-text);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin:10px 0 0">Moyens de paiement acceptés (transactions immobilières)</p>
      ${renderPaymentIconsBar(true)}
    </div>`;
  document.body.appendChild(bar);
}
