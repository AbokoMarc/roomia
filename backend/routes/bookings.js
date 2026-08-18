import crypto from 'node:crypto';
import { db } from '../db.js';
import { json, parseBody, notFound } from '../lib/http.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { notifyAdmins, notifyClient } from '../lib/notify.js';

function genCode() {
  return 'RM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function nightsBetween(checkIn, checkOut) {
  const a = new Date(checkIn), b = new Date(checkOut);
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

async function withRoom(booking) {
  const room = await db.prepare('SELECT id, title, city, images FROM rooms WHERE id = ?').get(booking.room_id);
  const payment = await db.prepare('SELECT * FROM payments WHERE booking_id = ? ORDER BY id DESC LIMIT 1').get(booking.id);
  return { ...booking, room: room ? { ...room, images: JSON.parse(room.images || '[]') } : null, payment };
}

export async function handleBookings(req, res, urlPath) {
  // POST /api/bookings — créer une réservation (statut en_attente jusqu'au paiement)
  if (urlPath === '/api/bookings' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const b = await parseBody(req);
    const { room_id, check_in, check_out, adults, children, special_requests, promo_code, travel_purpose } = b;
    if (!room_id || !check_in || !check_out) return json(res, 400, { error: 'Logement et dates requis.' });
    if (new Date(check_out) <= new Date(check_in)) return json(res, 400, { error: 'La date de départ doit être après la date d\'arrivée.' });

    const room = await db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
    if (!room || room.status !== 'disponible') return json(res, 404, { error: 'Logement indisponible.' });

    const conflict = await db.prepare(`
      SELECT id FROM bookings WHERE room_id = ? AND status IN ('en_attente', 'confirmee')
        AND NOT (date(?) >= date(check_out) OR date(?) <= date(check_in))
    `).get(room_id, check_in, check_out);
    if (conflict) return json(res, 409, { error: 'Ce logement n\'est plus disponible sur ces dates.' });

    const nights = nightsBetween(check_in, check_out);
    let total = nights * room.price_per_night;

    if (promo_code) {
      const promo = await db.prepare('SELECT * FROM promo_codes WHERE code = ? AND active = 1').get(promo_code.toUpperCase());
      if (promo && (!promo.expires_at || new Date(promo.expires_at) > new Date())) {
        total = total * (1 - promo.percent_off / 100);
      }
    }

    const code = genCode();
    const info = await db.prepare(`
      INSERT INTO bookings (code, room_id, user_id, check_in, check_out, adults, children, nights, price_per_night, total_price, special_requests, travel_purpose)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, room_id, user.id, check_in, check_out, Number(adults || 2), Number(children || 0), nights, room.price_per_night, Math.round(total), special_requests || null, travel_purpose || 'tourisme');

    const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid);
    await notifyAdmins('nouvelle_reservation', 'Nouvelle réservation', `${user.name} a réservé "${room.title}" (${code})`, { booking_id: booking.id });
    return json(res, 201, { booking: await withRoom(booking) });
  }

  // GET /api/bookings/mine — réservations du client connecté
  if (urlPath === '/api/bookings/mine' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    const rows = await db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
    const bookings = await Promise.all(rows.map(withRoom));
    return json(res, 200, { bookings });
  }

  // GET /api/admin/bookings — toutes les réservations (admin)
  if (urlPath === '/api/admin/bookings' && req.method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const rows = await db.prepare(`
      SELECT bookings.*, users.name as client_name, users.email as client_email, users.phone as client_phone
      FROM bookings JOIN users ON users.id = bookings.user_id ORDER BY bookings.created_at DESC
    `).all();
    const bookings = await Promise.all(rows.map(withRoom));
    return json(res, 200, { bookings });
  }

  // PUT /api/bookings/:id/cancel — annulation (client ou admin)
  const cancelMatch = urlPath.match(/^\/api\/bookings\/(\d+)\/cancel$/);
  if (cancelMatch && req.method === 'PUT') {
    const user = requireAuth(req, res);
    if (!user) return;
    const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(cancelMatch[1]);
    if (!booking) return notFound(res);
    if (user.role !== 'admin' && booking.user_id !== user.id) return json(res, 403, { error: 'Non autorisé.' });
    await db.prepare(`UPDATE bookings SET status = 'annulee' WHERE id = ?`).run(cancelMatch[1]);
    const updated = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(cancelMatch[1]);
    if (user.role === 'admin') {
      await notifyClient(booking.user_id, 'reservation_annulee', 'Réservation annulée', `Votre réservation ${booking.code} a été annulée.`, { booking_id: booking.id });
    } else {
      await notifyAdmins('reservation_annulee', 'Réservation annulée par le client', `${booking.code} a été annulée.`, { booking_id: booking.id });
    }
    return json(res, 200, { booking: await withRoom(updated) });
  }

  // PUT /api/admin/bookings/:id/status — confirmer / terminer (admin)
  const statusMatch = urlPath.match(/^\/api\/admin\/bookings\/(\d+)\/status$/);
  if (statusMatch && req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { status } = await parseBody(req);
    if (!['en_attente', 'confirmee', 'annulee', 'terminee'].includes(status)) return json(res, 400, { error: 'Statut invalide.' });
    const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(statusMatch[1]);
    if (!booking) return notFound(res);
    await db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, statusMatch[1]);
    const updated = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(statusMatch[1]);
    await notifyClient(booking.user_id, 'reservation_maj', 'Mise à jour de votre réservation', `Votre réservation ${booking.code} est maintenant : ${status.replace('_', ' ')}.`, { booking_id: booking.id });
    return json(res, 200, { booking: await withRoom(updated) });
  }

  return null;
}
