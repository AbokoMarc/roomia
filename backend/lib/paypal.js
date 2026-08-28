// Intégration PayPal (REST API v2 Orders) — paiement automatique.
// Aucune dépendance npm : tout passe par fetch natif.
// Doc officielle : https://developer.paypal.com/docs/api/orders/v2/

function paypalBase() {
  return process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

export function isPaypalConfigured() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function requireConfigured() {
  if (!isPaypalConfigured()) throw new Error('PAYPAL_NOT_CONFIGURED');
}

async function getAccessToken() {
  const creds = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Impossible d\'obtenir un jeton PayPal.');
  return data.access_token;
}

// Crée une commande PayPal. Retourne { orderId, approveUrl }.
export async function createPaypalOrder({ amount, currency, description, returnUrl, cancelUrl, customId }) {
  requireConfigured();
  const token = await getAccessToken();
  const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: currency, value: amount.toFixed(2) },
        description,
        custom_id: customId,
      }],
      application_context: {
        return_url: returnUrl, cancel_url: cancelUrl, brand_name: 'Roomia', user_action: 'PAY_NOW',
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur lors de la création de la commande PayPal.');
  const approveUrl = data.links.find(l => l.rel === 'approve')?.href;
  return { orderId: data.id, approveUrl };
}

// Capture le paiement d'une commande approuvée par le client — c'est cet appel qui prélève réellement l'argent.
export async function capturePaypalOrder(orderId) {
  requireConfigured();
  const token = await getAccessToken();
  const res = await fetch(`${paypalBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur lors de la capture du paiement PayPal.');
  return data; // data.status === 'COMPLETED' si réussi
}

// Vérifie l'authenticité d'un webhook PayPal auprès de PayPal lui-même (obligatoire, pas de simple comparaison locale possible).
export async function verifyPaypalWebhook(headers, rawBody) {
  requireConfigured();
  if (!process.env.PAYPAL_WEBHOOK_ID) return false;
  const token = await getAccessToken();
  const res = await fetch(`${paypalBase()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(rawBody.toString()),
    }),
  });
  const data = await res.json();
  return data.verification_status === 'SUCCESS';
}
