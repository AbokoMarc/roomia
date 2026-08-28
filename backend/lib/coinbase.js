// Intégration Coinbase Commerce — paiement crypto automatique (BTC, ETH, USDT...).
// Contrairement à un wallet perso, Coinbase Commerce génère une adresse unique par commande,
// ce qui permet de savoir avec certitude quelle réservation a été payée (webhook fiable).
// Aucune dépendance npm : fetch natif + crypto natif (vérification de signature).
// Doc officielle : https://docs.cdp.coinbase.com/commerce-onchain/docs/getting-started

import crypto from 'node:crypto';

const CB_BASE = 'https://api.commerce.coinbase.com';

export function isCoinbaseConfigured() {
  return !!process.env.COINBASE_COMMERCE_API_KEY;
}

function requireConfigured() {
  if (!isCoinbaseConfigured()) throw new Error('COINBASE_NOT_CONFIGURED');
}

// Crée une charge (facture crypto hébergée). Retourne { hostedUrl, chargeId, chargeCode }.
export async function createCoinbaseCharge({ name, description, amount, currency, metadata, redirectUrl, cancelUrl }) {
  requireConfigured();
  const res = await fetch(`${CB_BASE}/charges`, {
    method: 'POST',
    headers: {
      'X-CC-Api-Key': process.env.COINBASE_COMMERCE_API_KEY,
      'X-CC-Version': '2018-03-22',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name, description,
      pricing_type: 'fixed_price',
      local_price: { amount: amount.toFixed(2), currency },
      metadata,
      redirect_url: redirectUrl,
      cancel_url: cancelUrl,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Erreur lors de la création de la facture crypto.');
  return { hostedUrl: data.data.hosted_url, chargeId: data.data.id, chargeCode: data.data.code };
}

// Coinbase Commerce signe chaque webhook en HMAC-SHA256 du corps brut avec ta clé secrète partagée —
// on doit vérifier ça nous-mêmes (contrairement à Flutterwave qui utilise un simple hash statique).
export function isValidCoinbaseWebhook(rawBody, signatureHeader) {
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false; // longueurs différentes -> signature invalide
  }
}
