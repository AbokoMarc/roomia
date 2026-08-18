import { db } from '../db.js';
import { json, parseBody } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';

export async function handleReviews(req, res, urlPath) {
  if (urlPath === '/api/reviews' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const { room_id, booking_id, rating, comment } = await parseBody(req);
    if (!room_id || !rating) return json(res, 400, { error: 'Logement et note requis.' });
    if (rating < 1 || rating > 5) return json(res, 400, { error: 'La note doit être entre 1 et 5.' });

    if (booking_id) {
      const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(booking_id, user.id);
      if (!booking) return json(res, 403, { error: 'Réservation introuvable.' });
    }

    db.prepare('INSERT INTO reviews (room_id, user_id, booking_id, rating, comment) VALUES (?, ?, ?, ?, ?)')
      .run(room_id, user.id, booking_id || null, rating, comment || null);

    const stats = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE room_id = ?').get(room_id);
    db.prepare('UPDATE rooms SET rating = ?, reviews_count = ? WHERE id = ?').run(Math.round(stats.avg * 10) / 10, stats.count, room_id);

    return json(res, 201, { success: true });
  }
  return null;
}
