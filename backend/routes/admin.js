import { db } from '../db.js';
import { json } from '../lib/http.js';
import { requireAdmin } from '../lib/auth.js';

export async function handleAdminStats(req, res, urlPath) {
  if (urlPath === '/api/admin/stats' && req.method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const [totalRooms, activeRooms, totalBookings, pendingBookings, confirmedBookings, totalRevenueRow, pendingPayments, totalUsers, revenueByMethod, topRooms] = await Promise.all([
      db.prepare('SELECT COUNT(*) c FROM rooms').get(),
      db.prepare(`SELECT COUNT(*) c FROM rooms WHERE status = 'disponible'`).get(),
      db.prepare('SELECT COUNT(*) c FROM bookings').get(),
      db.prepare(`SELECT COUNT(*) c FROM bookings WHERE status = 'en_attente'`).get(),
      db.prepare(`SELECT COUNT(*) c FROM bookings WHERE status = 'confirmee'`).get(),
      db.prepare(`SELECT COALESCE(SUM(amount), 0) s FROM payments WHERE status = 'valide'`).get(),
      db.prepare(`SELECT COUNT(*) c FROM payments WHERE status = 'en_attente'`).get(),
      db.prepare(`SELECT COUNT(*) c FROM users WHERE role = 'client'`).get(),
      db.prepare(`
        SELECT method, COALESCE(SUM(amount),0) as total, COUNT(*) as count
        FROM payments WHERE status = 'valide' GROUP BY method
      `).all(),
      db.prepare(`
        SELECT rooms.id, rooms.title, rooms.city, COUNT(bookings.id) as bookings_count
        FROM rooms LEFT JOIN bookings ON bookings.room_id = rooms.id
        GROUP BY rooms.id ORDER BY bookings_count DESC LIMIT 5
      `).all(),
    ]);

    return json(res, 200, {
      totalRooms: totalRooms.c, activeRooms: activeRooms.c, totalBookings: totalBookings.c,
      pendingBookings: pendingBookings.c, confirmedBookings: confirmedBookings.c,
      totalRevenue: totalRevenueRow.s, pendingPayments: pendingPayments.c, totalUsers: totalUsers.c,
      revenueByMethod, topRooms,
    });
  }

  // GET /api/admin/users
  if (urlPath === '/api/admin/users' && req.method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const users = await db.prepare(`SELECT id, name, email, phone, role, loyalty_points, created_at FROM users ORDER BY created_at DESC`).all();
    return json(res, 200, { users });
  }

  return null;
}
