import { db } from '../db.js';
import { json, parseBody, notFound } from '../lib/http.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { notifyAdmins, notifyClient } from '../lib/notify.js';

const METHODS = ['mobile_money', 'carte', 'paypal', 'crypto'];

// Les méthodes qui peuvent être confirmées automatiquement (via un vrai gateway branché plus tard)
// vs celles qui nécessitent une vérification manuelle (mobile money par notif SMS, crypto par hash de transaction)
const AUTO_CONFIRM = []; // à activer quand une vraie intégration (Stripe, CamPay, PayPal SDK...) sera branchée

export async function handlePayments(req, res, urlPath) {
  // GET /api/payments/accounts — comptes de destination actifs (public, pour affichage au checkout)
  if (urlPath === '/api/payments/accounts' && req.method === 'GET') {
    const accounts = await db.prepare('SELECT method, label, destination FROM payout_accounts WHERE active = 1').all();
    return json(res, 200, { accounts });
  }

  // POST /api/payments — enregistrer un paiement pour une réservation
  if (urlPath === '/api/payments' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const b = await parseBody(req);
    const { booking_id, method, provider, reference, proof } = b;
    if (!booking_id || !method) return json(res, 400, { error: 'Réservation et méthode de paiement requises.' });
    if (!METHODS.includes(method)) return json(res, 400, { error: 'Méthode de paiement invalide.' });

    const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id);
    if (!booking) return notFound(res);
    if (booking.user_id !== user.id) return json(res, 403, { error: 'Non autorisé.' });

    const status = AUTO_CONFIRM.includes(method) ? 'valide' : 'en_attente';
    const info = await db.prepare(`
      INSERT INTO payments (booking_id, method, provider, amount, currency, status, reference, proof)
      VALUES (?, ?, ?, ?, 'EUR', ?, ?, ?)
    `).run(booking_id, method, provider || null, booking.total_price, status, reference || null, proof || null);

    if (status === 'valide') {
      await db.prepare(`UPDATE bookings SET status = 'confirmee' WHERE id = ?`).run(booking_id);
      await db.prepare(`UPDATE payments SET validated_at = datetime('now') WHERE id = ?`).run(info.lastInsertRowid);
      await db.prepare(`UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?`).run(Math.round(booking.total_price / 1000), user.id);
    }

    const payment = await db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid);
    await notifyAdmins(
      'nouveau_paiement',
      status === 'valide' ? 'Paiement validé automatiquement' : 'Paiement à vérifier',
      `${method.replace('_', ' ')} — réservation ${booking.code} — ${booking.total_price.toLocaleString('fr-FR')} €`,
      { booking_id: booking.id, payment_id: payment.id }
    );
    return json(res, 201, { payment });
  }

  // GET /api/admin/payments — liste des paiements (admin)
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

  // PUT /api/admin/payments/:id/validate — valider un paiement manuel (mobile money / crypto)
  const validateMatch = urlPath.match(/^\/api\/admin\/payments\/(\d+)\/validate$/);
  if (validateMatch && req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { admin_note } = await parseBody(req);
    const payment = await db.prepare('SELECT * FROM payments WHERE id = ?').get(validateMatch[1]);
    if (!payment) return notFound(res);
    await db.prepare(`UPDATE payments SET status = 'valide', admin_note = ?, validated_at = datetime('now') WHERE id = ?`).run(admin_note || null, validateMatch[1]);
    const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(payment.booking_id);
    await db.prepare(`UPDATE bookings SET status = 'confirmee' WHERE id = ?`).run(booking.id);
    await db.prepare(`UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?`).run(Math.round(booking.total_price / 1000), booking.user_id);
    await notifyClient(booking.user_id, 'paiement_valide', 'Paiement confirmé', `Votre paiement pour la réservation ${booking.code} est validé. Séjour confirmé !`, { booking_id: booking.id });
    return json(res, 200, { success: true });
  }

  // PUT /api/admin/payments/:id/reject — rejeter un paiement
  const rejectMatch = urlPath.match(/^\/api\/admin\/payments\/(\d+)\/reject$/);
  if (rejectMatch && req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { admin_note } = await parseBody(req);
    const payment = await db.prepare('SELECT * FROM payments WHERE id = ?').get(rejectMatch[1]);
    if (!payment) return notFound(res);
    await db.prepare(`UPDATE payments SET status = 'echoue', admin_note = ? WHERE id = ?`).run(admin_note || null, rejectMatch[1]);
    const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(payment.booking_id);
    await notifyClient(booking.user_id, 'paiement_rejete', 'Paiement refusé', `Votre paiement pour la réservation ${booking.code} n'a pas pu être vérifié. ${admin_note || ''}`, { booking_id: booking.id });
    return json(res, 200, { success: true });
  }

  // ---- Comptes de destination (admin) : où atterrit l'argent pour chaque méthode ----
  if (urlPath === '/api/admin/payout-accounts' && req.method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const accounts = await db.prepare('SELECT * FROM payout_accounts').all();
    return json(res, 200, { accounts });
  }

  if (urlPath === '/api/admin/payout-accounts' && req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { method, label, destination, settlement_note, active } = await parseBody(req);
    if (!METHODS.includes(method) || !destination) return json(res, 400, { error: 'Méthode et destination requises.' });
    await db.prepare(`
      INSERT INTO payout_accounts (method, label, destination, settlement_note, active) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(method) DO UPDATE SET label = excluded.label, destination = excluded.destination,
        settlement_note = excluded.settlement_note, active = excluded.active
    `).run(method, label || method, destination, settlement_note || null, active === false ? 0 : 1);
    const accounts = await db.prepare('SELECT * FROM payout_accounts').all();
    return json(res, 200, { accounts });
  }

  return null;
}
