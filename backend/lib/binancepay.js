// Intégration Binance Pay pour marchands — paiement crypto automatique.
// ⚠️ Écrit avec le meilleur soin possible mais PAS testé en conditions réelles (pas d'accès réseau
// dans l'environnement de développement). Vérifie attentivement après configuration — voir README.
// Doc officielle : https://developers.binance.com/docs/binance-pay/introduction
//
// Aucune dépendance npm : fetch natif + crypto natif (signature HMAC-SHA512).

import crypto from 'node:crypto';

const BP_BASE = 'https://bpay.binanceapi.com';

export function isBinancePayConfigured() {
  return !!(process.env.BINANCE_PAY_API_KEY && process.env.BINANCE_PAY_SECRET_KEY);
}

function requireConfigured() {
  if (!isBinancePayConfigured()) throw new Error('BINANCE_PAY_NOT_CONFIGURED');
}

function randomNonce() {
  return crypto.randomBytes(16).toString('hex'); // 32 caractères, format attendu par Binance Pay
}

// Binance Pay signe (et vérifie) avec le même schéma des deux côtés :
// HMAC-SHA512( timestamp + "\n" + nonce + "\n" + corps_brut + "\n" , clé secrète ), en hexadécimal MAJUSCULES.
function sign(timestamp, nonce, body) {
  const payload = `${timestamp}\n${nonce}\n${body}\n`;
  return crypto.createHmac('sha512', process.env.BINANCE_PAY_SECRET_KEY).update(payload).digest('hex').toUpperCase();
}

// Crée une commande Binance Pay. Retourne { checkoutUrl, prepayId }.
export async function createBinancePayOrder({ merchantTradeNo, amount, currency, goodsName, returnUrl, cancelUrl }) {
  requireConfigured();
  const timestamp = Date.now().toString();
  const nonce = randomNonce();
  const body = JSON.stringify({
    env: { terminalType: 'WEB' },
    merchantTradeNo,
    orderAmount: amount,
    currency, // ex : 'USDT' — vérifie que ta devise est bien acceptée par ton compte marchand (voir README)
    goods: { goodsType: '02', goodsCategory: 'Z000', referenceGoodsId: merchantTradeNo, goodsName },
    returnUrl,
    cancelUrl,
  });
  const signature = sign(timestamp, nonce, body);

  const res = await fetch(`${BP_BASE}/binancepay/openapi/v3/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': timestamp,
      'BinancePay-Nonce': nonce,
      'BinancePay-Certificate-SN': process.env.BINANCE_PAY_API_KEY,
      'BinancePay-Signature': signature,
    },
    body,
  });
  const data = await res.json();
  if (!res.ok || data.status !== 'SUCCESS') {
    throw new Error(data.errorMessage || 'Erreur lors de la création de la commande Binance Pay.');
  }
  return { checkoutUrl: data.data.checkoutUrl, prepayId: data.data.prepayId };
}

// Vérifie la signature d'un webhook entrant (même schéma HMAC que sign(), calculé avec TA clé secrète).
export function isValidBinancePayWebhook(timestamp, nonce, rawBody, signatureHeader) {
  if (!isBinancePayConfigured() || !timestamp || !nonce || !signatureHeader) return false;
  const expected = sign(timestamp, nonce, rawBody.toString());
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

// Binance Pay attend cette réponse exacte pour ne pas renvoyer le webhook en boucle.
export const BINANCE_PAY_WEBHOOK_ACK = JSON.stringify({ returnCode: 'SUCCESS', returnMessage: null });
