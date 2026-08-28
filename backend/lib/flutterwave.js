// Intégration Flutterwave (API REST v3) — paiement carte automatique.
// Aucune dépendance npm : tout passe par fetch natif.
// Doc officielle : https://developer.flutterwave.com/docs

const FLW_BASE = 'https://api.flutterwave.com/v3';

export function isFlutterwaveConfigured() {
  return !!process.env.FLUTTERWAVE_SECRET_KEY;
}

function requireConfigured() {
  if (!isFlutterwaveConfigured()) throw new Error('FLUTTERWAVE_NOT_CONFIGURED');
}

// Crée une session de paiement hébergée chez Flutterwave. Retourne { link, tx_ref }.
export async function createFlutterwavePayment({ txRef, amount, currency, customerEmail, customerName, description, redirectUrl }) {
  requireConfigured();
  const res = await fetch(`${FLW_BASE}/payments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount,
      currency,
      redirect_url: redirectUrl,
      customer: { email: customerEmail, name: customerName },
      customizations: { title: 'Roomia', description },
    }),
  });
  const data = await res.json();
  if (!res.ok || data.status !== 'success') {
    throw new Error(data.message || 'Erreur lors de la création du paiement Flutterwave.');
  }
  return { link: data.data.link, txRef };
}

// Vérifie une transaction directement auprès de Flutterwave (jamais faire confiance au seul retour navigateur).
export async function verifyFlutterwaveTransaction(transactionId) {
  requireConfigured();
  const res = await fetch(`${FLW_BASE}/transactions/${transactionId}/verify`, {
    headers: { 'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
  });
  const data = await res.json();
  if (!res.ok || data.status !== 'success') throw new Error('Impossible de vérifier la transaction Flutterwave.');
  return data.data; // { status, amount, currency, tx_ref, id, ... }
}

// Le webhook Flutterwave envoie un header 'verif-hash' qui doit correspondre exactement
// au secret que tu as toi-même configuré dans ton tableau de bord Flutterwave (pas une signature calculée).
export function isValidFlutterwaveWebhook(headerHash) {
  const expected = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
  return !!expected && headerHash === expected;
}
