import crypto from 'node:crypto';
import { db } from '../db.js';
import { json, parseBody, parseRawBody, notFound } from '../lib/http.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { notifyAdmins, notifyClient } from '../lib/notify.js';
import { createFlutterwavePayment, verifyFlutterwaveTransaction, isValidFlutterwaveWebhook, isFlutterwaveConfigured } from '../lib/flutterwave.js';
import { createPaypalOrder, capturePaypalOrder, verifyPaypalWebhook, isPaypalConfigured } from '../lib/paypal.js';

function originOf(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host}`;
}

// Marque un paiement comme validé + confirme la réservation + crédite les points fidélité + notifie tout le monde.
// Utilisé par les webhooks Flutterwave/PayPal et par la validation manuelle admin — logique commune, une seule source de vérité.
async function markPaymentValidated(paymentId, providerLabel) {
  const payment = await db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
  if (!payment || payment.status === 'valide') return; // déjà traité (webhook peut arriver plusieurs fois) — idempotent
  await db.prepare(`UPDATE payments SET status = 'valide', validated_at = datetime('now') WHERE id = ?`).run(paymentId);
  const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(payment.booking_id);
  if (!booking) return;
  await db.prepare(`UPDATE bookings SET status = 'confirmee' WHERE id = ?`).run(booking.id);
  await db.prepare(`UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?`).run(Math.round(booking.total_price / 1000), booking.user_id);
  await notifyClient(booking.user_id, 'paiement_valide', 'Paiement confirmé', `Votre paiement (${providerLabel}) pour la réservation ${booking.code} est validé automatiquement. Séjour confirmé !`, { booking_id: booking.id });
  await notifyAdmins('nouveau_paiement', 'Paiement validé automatiquement', `${providerLabel} — réservation ${booking.code} — ${booking.total_price.toLocaleString('fr-FR')} €`, { booking_id: booking.id });
}

async function loadOwnedBooking(bookingId, userId, res) {
  const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) { notFound(res); return null; }
  if (booking.user_id !== userId) { json(res, 403, { error: 'Non autorisé.' }); return null; }
  if (booking.status !== 'en_attente') { json(res, 409, { error: 'Cette réservation a déjà été traitée.' }); return null; }
  return booking;
}

export async function handlePayments(req, res, urlPath) {
  // ============ FLUTTERWAVE (carte) ============
  if (urlPath === '/api/payments/flutterwave/create-checkout' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!isFlutterwaveConfigured()) return json(res, 503, { error: "Le paiement par carte n'est pas encore configuré. Choisis une autre méthode." });
    const { booking_id } = await parseBody(req);
    const booking = await loadOwnedBooking(booking_id, user.id, res);
    if (!booking) return;

    const txRef = `RM-${booking.id}-${crypto.randomBytes(4).toString('hex')}`;
    const info = await db.prepare(`INSERT INTO payments (booking_id, method, provider, amount, currency, status, reference) VALUES (?, 'carte', 'flutterwave', ?, 'EUR', 'en_attente', ?)`)
      .run(booking.id, booking.total_price, txRef);

    try {
      const origin = originOf(req);
      const { link } = await createFlutterwavePayment({
        txRef, amount: booking.total_price, currency: 'EUR',
        customerEmail: user.email, customerName: user.name,
        description: `Réservation ${booking.code}`,
        redirectUrl: `${origin}/checkout.html?booking=${booking.id}&pay=return`,
      });
      return json(res, 200, { url: link });
    } catch (err) {
      console.error('Erreur Flutterwave:', err);
      await db.prepare('UPDATE payments SET status = \'echoue\' WHERE id = ?').run(info.lastInsertRowid);
      return json(res, 502, { error: "Impossible de contacter Flutterwave pour l'instant. Réessaie dans un instant." });
    }
  }

  if (urlPath === '/api/payments/flutterwave/webhook' && req.method === 'POST') {
    const rawBody = await parseRawBody(req);
    if (!isValidFlutterwaveWebhook(req.headers['verif-hash'])) { res.writeHead(401); return res.end(); }
    let event;
    try { event = JSON.parse(rawBody.toString()); } catch { res.writeHead(400); return res.end(); }

    if (event.data?.status === 'successful' && event.data?.tx_ref) {
      try {
        const verified = await verifyFlutterwaveTransaction(event.data.id);
        if (verified.status === 'successful') {
          const payment = await db.prepare('SELECT * FROM payments WHERE reference = ?').get(event.data.tx_ref);
          if (payment) await markPaymentValidated(payment.id, 'Flutterwave');
        }
      } catch (err) { console.error('Erreur vérification webhook Flutterwave:', err); }
    }
    res.writeHead(200); return res.end();
  }

  // ============ PAYPAL ============
  if (urlPath === '/api/payments/paypal/create-checkout' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!isPaypalConfigured()) return json(res, 503, { error: "PayPal n'est pas encore configuré. Choisis une autre méthode." });
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
      // Remplace le placeholder maintenant qu'on connaît orderId (PayPal ne permet pas de le connaître avant création)
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

  // ============ CRYPTO (paiement manuel — wallet perso, le client colle le hash, l'admin vérifie et valide) ============
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

  // POST /api/payments — soumission manuelle d'un paiement crypto (le client colle le hash de sa transaction)
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

  // ============ Admin : validation des paiements (obligatoire pour crypto, filet de sécurité pour carte/PayPal) ============
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
