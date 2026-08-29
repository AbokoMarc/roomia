import crypto from 'node:crypto';
import { db } from '../db.js';
import { json, parseBody, parseRawBody, notFound } from '../lib/http.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { notifyAdmins, notifyClient } from '../lib/notify.js';
import { createPaypalOrder, capturePaypalOrder, verifyPaypalWebhook, isPaypalConfigured } from '../lib/paypal.js';
import { createBinancePayOrder, isValidBinancePayWebhook, isBinancePayConfigured, BINANCE_PAY_WEBHOOK_ACK } from '../lib/binancepay.js';

function originOf(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host}`;
}

async function getSetting(key, fallback = null) {
  const row = await db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
async function setSetting(key, value) {
  await db.prepare(`
    INSERT INTO app_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

// Marque un paiement comme validé + confirme la réservation + crédite les points fidélité + notifie tout le monde.
// Utilisé par le webhook PayPal et par la validation manuelle admin (Neero, crypto) — logique commune, une seule source de vérité.
async function markPaymentValidated(paymentId, providerLabel) {
  const payment = await db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
  if (!payment || payment.status === 'valide') return; // déjà traité (webhook peut arriver plusieurs fois) — idempotent
  await db.prepare(`UPDATE payments SET status = 'valide', validated_at = datetime('now') WHERE id = ?`).run(paymentId);
  const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(payment.booking_id);
  if (!booking) return;
  await db.prepare(`UPDATE bookings SET status = 'confirmee' WHERE id = ?`).run(booking.id);
  await db.prepare(`UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?`).run(Math.round(booking.total_price / 1000), booking.user_id);
  await notifyClient(booking.user_id, 'paiement_valide', 'Paiement confirmé', `Votre paiement (${providerLabel}) pour la réservation ${booking.code} est validé. Séjour confirmé !`, { booking_id: booking.id });
  await notifyAdmins('nouveau_paiement', 'Paiement validé', `${providerLabel} — réservation ${booking.code} — ${booking.total_price.toLocaleString('fr-FR')} €`, { booking_id: booking.id });
}

async function loadOwnedBooking(bookingId, userId, res) {
  const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) { notFound(res); return null; }
  if (booking.user_id !== userId) { json(res, 403, { error: 'Non autorisé.' }); return null; }
  if (booking.status !== 'en_attente') { json(res, 409, { error: 'Cette réservation a déjà été traitée.' }); return null; }
  return booking;
}

export async function handlePayments(req, res, urlPath) {
  // ============ Méthodes actives (public — pour savoir quoi afficher au checkout) ============
  if (urlPath === '/api/payments/methods' && req.method === 'GET') {
    const paypalEnabled = (await getSetting('paypal_enabled', 'false')) === 'true';
    return json(res, 200, {
      paypal_enabled: paypalEnabled && isPaypalConfigured(),
      crypto_auto: isBinancePayConfigured(),
    });
  }

  if (urlPath === '/api/admin/settings/paypal' && req.method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const enabled = (await getSetting('paypal_enabled', 'false')) === 'true';
    return json(res, 200, { enabled, configured: isPaypalConfigured() });
  }

  if (urlPath === '/api/admin/settings/paypal' && req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { enabled } = await parseBody(req);
    await setSetting('paypal_enabled', enabled ? 'true' : 'false');
    return json(res, 200, { success: true });
  }

  // ============ NEERO (paiement manuel — virement, le client colle une référence, l'admin vérifie et valide) ============
  if (urlPath === '/api/payments/neero-account' && req.method === 'GET') {
    const account = await db.prepare('SELECT account_name, account_number, note FROM neero_account WHERE id = 1').get();
    return json(res, 200, { account: account || null });
  }

  if (urlPath === '/api/admin/neero-account' && req.method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const account = await db.prepare('SELECT account_name, account_number, note FROM neero_account WHERE id = 1').get();
    return json(res, 200, { account: account || null });
  }

  if (urlPath === '/api/admin/neero-account' && req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { account_name, account_number, note } = await parseBody(req);
    if (!account_number) return json(res, 400, { error: 'Numéro de compte requis.' });
    await db.prepare(`
      INSERT INTO neero_account (id, account_name, account_number, note, updated_at) VALUES (1, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET account_name = excluded.account_name, account_number = excluded.account_number, note = excluded.note, updated_at = datetime('now')
    `).run(account_name || null, account_number, note || null);
    return json(res, 200, { success: true });
  }

  // ============ CRYPTO (paiement manuel — wallet perso) ============
  if (urlPath === '/api/payments/crypto-wallet' && req.method === 'GET') {
    const wallet = await db.prepare('SELECT address, network_note FROM crypto_wallet WHERE id = 1').get();
    return json(res, 200, { wallet: wallet || null });
  }

  if (urlPath === '/api/admin/crypto-wallet' && req.method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const wallet = await db.prepare('SELECT address, network_note FROM crypto_wallet WHERE id = 1').get();
    return json(res, 200, { wallet: wallet || null });
  }

  if (urlPath === '/api/admin/crypto-wallet' && req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { address, network_note } = await parseBody(req);
    if (!address) return json(res, 400, { error: 'Adresse wallet requise.' });
    await db.prepare(`
      INSERT INTO crypto_wallet (id, address, network_note, updated_at) VALUES (1, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET address = excluded.address, network_note = excluded.network_note, updated_at = datetime('now')
    `).run(address, network_note || null);
    return json(res, 200, { success: true });
  }

  // ============ BINANCE PAY (crypto automatique — utilisé si configuré, sinon repli sur le wallet manuel ci-dessus) ============
  if (urlPath === '/api/payments/binancepay/create-checkout' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!isBinancePayConfigured()) return json(res, 503, { error: "Le paiement crypto automatique n'est pas configuré." });
    const { booking_id } = await parseBody(req);
    const booking = await loadOwnedBooking(booking_id, user.id, res);
    if (!booking) return;

    const merchantTradeNo = `RM${booking.id}${crypto.randomBytes(4).toString('hex')}`;
    const info = await db.prepare(`INSERT INTO payments (booking_id, method, provider, amount, currency, status, reference) VALUES (?, 'crypto', 'binance_pay', ?, 'EUR', 'en_attente', ?)`)
      .run(booking.id, booking.total_price, merchantTradeNo);

    try {
      const origin = originOf(req);
      const currency = process.env.BINANCE_PAY_CURRENCY || 'USDT';
      const { checkoutUrl } = await createBinancePayOrder({
        merchantTradeNo, amount: booking.total_price, currency,
        goodsName: `Réservation ${booking.code}`,
        returnUrl: `${origin}/checkout.html?booking=${booking.id}&pay=return`,
        cancelUrl: `${origin}/checkout.html?booking=${booking.id}&pay=cancel`,
      });
      return json(res, 200, { url: checkoutUrl });
    } catch (err) {
      console.error('Erreur Binance Pay:', err);
      await db.prepare('UPDATE payments SET status = \'echoue\' WHERE id = ?').run(info.lastInsertRowid);
      return json(res, 502, { error: "Impossible de contacter Binance Pay pour l'instant. Réessaie ou choisis le wallet manuel." });
    }
  }

  if (urlPath === '/api/payments/binancepay/webhook' && req.method === 'POST') {
    const rawBody = await parseRawBody(req);
    const valid = isValidBinancePayWebhook(req.headers['binancepay-timestamp'], req.headers['binancepay-nonce'], rawBody, req.headers['binancepay-signature']);
    if (!valid) { res.writeHead(401); return res.end(); }

    let event;
    try { event = JSON.parse(rawBody.toString()); } catch { res.writeHead(400); return res.end(); }

    if (event.bizType === 'PAY' && event.bizStatus === 'PAY_SUCCESS') {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const merchantTradeNo = data?.merchantTradeNo;
        if (merchantTradeNo) {
          const payment = await db.prepare('SELECT * FROM payments WHERE reference = ?').get(merchantTradeNo);
          if (payment) await markPaymentValidated(payment.id, 'Binance Pay');
        }
      } catch (err) { console.error('Erreur traitement webhook Binance Pay:', err); }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(BINANCE_PAY_WEBHOOK_ACK);
  }

  // POST /api/payments — soumission manuelle (Neero ou crypto) : le client colle une référence/hash, l'admin valide ensuite
  if (urlPath === '/api/payments' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const { booking_id, method, provider, reference } = await parseBody(req);
    if (!['carte', 'crypto'].includes(method)) return json(res, 400, { error: 'Méthode de paiement invalide.' });
    if (!booking_id || !reference) return json(res, 400, { error: 'Réservation et référence de paiement requises.' });
    const booking = await loadOwnedBooking(booking_id, user.id, res);
    if (!booking) return;

    const info = await db.prepare(`INSERT INTO payments (booking_id, method, provider, amount, currency, status, reference) VALUES (?, ?, ?, ?, 'EUR', 'en_attente', ?)`)
      .run(booking.id, method, provider || (method === 'carte' ? 'neero' : 'crypto'), booking.total_price, reference);

    const label = method === 'carte' ? 'Neero (virement)' : 'crypto';
    await notifyAdmins('nouveau_paiement', `Paiement ${label} à vérifier`, `Réservation ${booking.code} — ${booking.total_price.toLocaleString('fr-FR')} € — référence : ${reference}`, { booking_id: booking.id, payment_id: info.lastInsertRowid });
    return json(res, 201, { success: true });
  }

  // ============ PAYPAL (automatique — désactivé par défaut côté client, activable dans l'admin) ============
  if (urlPath === '/api/payments/paypal/create-checkout' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const enabled = (await getSetting('paypal_enabled', 'false')) === 'true';
    if (!enabled || !isPaypalConfigured()) return json(res, 503, { error: "PayPal n'est pas disponible pour le moment. Choisis une autre méthode." });
    const { booking_id } = await parseBody(req);
    const booking = await loadOwnedBooking(booking_id, user.id, res);
    if (!booking) return;

    const info = await db.prepare(`INSERT INTO payments (booking_id, method, provider, amount, currency, status) VALUES (?, 'paypal', 'paypal', ?, 'EUR', 'en_attente')`)
      .run(booking.id, booking.total_price);

    try {
      const origin = originOf(req);
      const { orderId, approveUrl } = await createPaypalOrder({
        amount: booking.total_price, currency: 'EUR', description: `Réservation ${booking.code}`,
        returnUrl: `${origin}/checkout.html?booking=${booking.id}&pay=return&paypal_order=PLACEHOLDER`,
        cancelUrl: `${origin}/checkout.html?booking=${booking.id}&pay=cancel`,
        customId: String(info.lastInsertRowid),
      });
      await db.prepare('UPDATE payments SET reference = ? WHERE id = ?').run(orderId, info.lastInsertRowid);
      const fixedApproveUrl = approveUrl.replace('PLACEHOLDER', orderId);
      return json(res, 200, { url: fixedApproveUrl });
    } catch (err) {
      console.error('Erreur PayPal:', err);
      await db.prepare('UPDATE payments SET status = \'echoue\' WHERE id = ?').run(info.lastInsertRowid);
      return json(res, 502, { error: "Impossible de contacter PayPal pour l'instant. Réessaie dans un instant." });
    }
  }

  if (urlPath === '/api/payments/paypal/webhook' && req.method === 'POST') {
    const rawBody = await parseRawBody(req);
    let event;
    try { event = JSON.parse(rawBody.toString()); } catch { res.writeHead(400); return res.end(); }

    const validSig = await verifyPaypalWebhook(req.headers, rawBody).catch(() => false);
    if (!validSig) { res.writeHead(401); return res.end(); }

    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = event.resource?.id;
      try {
        const captured = await capturePaypalOrder(orderId);
        if (captured.status === 'COMPLETED') {
          const payment = await db.prepare('SELECT * FROM payments WHERE reference = ?').get(orderId);
          if (payment) await markPaymentValidated(payment.id, 'PayPal');
        }
      } catch (err) { console.error('Erreur capture PayPal:', err); }
    }
    res.writeHead(200); return res.end();
  }

  // ============ Admin : liste + validation/rejet des paiements ============
  if (urlPath === '/api/admin/payments' && req.method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const payments = await db.prepare(`
      SELECT payments.*, bookings.code as booking_code, users.name as client_name, users.email as client_email
      FROM payments
      JOIN bookings ON bookings.id = payments.booking_id
      JOIN users ON users.id = bookings.user_id
      ORDER BY payments.created_at DESC
    `).all();
    return json(res, 200, { payments });
  }

  const validateMatch = urlPath.match(/^\/api\/admin\/payments\/(\d+)\/validate$/);
  if (validateMatch && req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    await markPaymentValidated(validateMatch[1], 'Validation manuelle admin');
    return json(res, 200, { success: true });
  }

  const rejectMatch = urlPath.match(/^\/api\/admin\/payments\/(\d+)\/reject$/);
  if (rejectMatch && req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { admin_note } = await parseBody(req);
    const payment = await db.prepare('SELECT * FROM payments WHERE id = ?').get(rejectMatch[1]);
    if (!payment) return notFound(res);
    await db.prepare(`UPDATE payments SET status = 'echoue', admin_note = ? WHERE id = ?`).run(admin_note || null, rejectMatch[1]);
    const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(payment.booking_id);
    if (booking) await notifyClient(booking.user_id, 'paiement_rejete', 'Paiement refusé', `Ton paiement pour la réservation ${booking.code} n'a pas pu être confirmé. ${admin_note || ''}`, { booking_id: booking.id });
    return json(res, 200, { success: true });
  }

  return null;
}
