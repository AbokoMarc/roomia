import crypto from 'node:crypto';
import { db } from '../db.js';
import { json, parseBody, parseRawBody, notFound } from '../lib/http.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { notifyAdmins, notifyClient } from '../lib/notify.js';
import { createBinancePayOrder, isValidBinancePayWebhook, isBinancePayConfigured, BINANCE_PAY_WEBHOOK_ACK } from '../lib/binancepay.js';

function originOf(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host}`;
}

// Marque un paiement comme validé + confirme la réservation + crédite les points fidélité + notifie tout le monde.
// Utilisé par le webhook Binance Pay et par la validation manuelle admin (wallet crypto) — une seule source de vérité.
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
  // ============ Méthodes actives (public) ============
  if (urlPath === '/api/payments/methods' && req.method === 'GET') {
    return json(res, 200, { crypto_auto: isBinancePayConfigured() });
  }

  // ============ CRYPTO — wallet manuel (repli si Binance Pay non configuré) ============
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

  // POST /api/payments — soumission manuelle crypto (wallet perso) : le client colle le hash, l'admin valide ensuite
  if (urlPath === '/api/payments' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const { booking_id, provider, reference } = await parseBody(req);
    if (!booking_id || !reference) return json(res, 400, { error: 'Réservation et hash de transaction requis.' });
    const booking = await loadOwnedBooking(booking_id, user.id, res);
    if (!booking) return;

    const info = await db.prepare(`INSERT INTO payments (booking_id, method, provider, amount, currency, status, reference) VALUES (?, 'crypto', ?, ?, 'EUR', 'en_attente', ?)`)
      .run(booking.id, provider || 'crypto', booking.total_price, reference);

    await notifyAdmins('nouveau_paiement', 'Paiement crypto à vérifier', `Réservation ${booking.code} — ${booking.total_price.toLocaleString('fr-FR')} € — hash : ${reference}`, { booking_id: booking.id, payment_id: info.lastInsertRowid });
    return json(res, 201, { success: true });
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
