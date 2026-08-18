import { db } from '../db.js';
import { json, parseBody, notFound } from '../lib/http.js';
import { requireAdmin, getAuthUser } from '../lib/auth.js';
import { notifyAdmins } from '../lib/notify.js';

function parseRoom(r) {
  return { ...r, amenities: JSON.parse(r.amenities || '[]'), images: JSON.parse(r.images || '[]') };
}

// Vérifie si une chambre a un chevauchement de réservation confirmée/en attente sur la période
function isAvailable(roomId, checkIn, checkOut) {
  const conflict = db.prepare(`
    SELECT id FROM bookings
    WHERE room_id = ? AND status IN ('en_attente', 'confirmee')
      AND NOT (date(?) >= date(check_out) OR date(?) <= date(check_in))
  `).get(roomId, checkIn, checkOut);
  return !conflict;
}

export async function handleRooms(req, res, urlPath, urlObj) {
  // GET /api/rooms — recherche publique avec filtres
  if (urlPath === '/api/rooms' && req.method === 'GET') {
    const q = urlObj.searchParams;
    const city = q.get('city');
    const country = q.get('country');
    const type = q.get('type');
    const adults = q.get('adults');
    const checkIn = q.get('check_in');
    const checkOut = q.get('check_out');
    const minPrice = q.get('min_price');
    const maxPrice = q.get('max_price');

    let sql = `SELECT * FROM rooms WHERE status = 'disponible'`;
    const params = [];
    if (city) { sql += ` AND city LIKE ?`; params.push(`%${city}%`); }
    if (country) { sql += ` AND country = ?`; params.push(country); }
    if (type) { sql += ` AND type = ?`; params.push(type); }
    if (adults) { sql += ` AND capacity_adults >= ?`; params.push(Number(adults)); }
    if (minPrice) { sql += ` AND price_per_night >= ?`; params.push(Number(minPrice)); }
    if (maxPrice) { sql += ` AND price_per_night <= ?`; params.push(Number(maxPrice)); }
    sql += ` ORDER BY featured DESC, created_at DESC`;

    let rooms = db.prepare(sql).all(...params).map(parseRoom);
    if (checkIn && checkOut) {
      rooms = rooms.filter(r => isAvailable(r.id, checkIn, checkOut));
    }
    return json(res, 200, { rooms });
  }

  // GET /api/rooms/cities — villes avec nombre de logements (pour la page d'accueil)
  if (urlPath === '/api/rooms/cities' && req.method === 'GET') {
    const cities = db.prepare(`
      SELECT city, country, COUNT(*) as count FROM rooms WHERE status = 'disponible' GROUP BY city ORDER BY count DESC
    `).all();
    return json(res, 200, { cities });
  }

  if (urlPath === '/api/rooms/countries' && req.method === 'GET') {
    const countries = db.prepare(`
      SELECT country, COUNT(*) as count FROM rooms WHERE status = 'disponible' GROUP BY country ORDER BY count DESC
    `).all();
    return json(res, 200, { countries });
  }

  // GET /api/rooms/:id
  const singleMatch = urlPath.match(/^\/api\/rooms\/(\d+)$/);
  if (singleMatch && req.method === 'GET') {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(singleMatch[1]);
    if (!room) return notFound(res);
    const reviews = db.prepare(`
      SELECT reviews.*, users.name as user_name FROM reviews
      JOIN users ON users.id = reviews.user_id
      WHERE room_id = ? ORDER BY reviews.created_at DESC
    `).all(singleMatch[1]);
    return json(res, 200, { room: parseRoom(room), reviews });
  }

  // GET /api/rooms/:id/availability?check_in=&check_out=
  const availMatch = urlPath.match(/^\/api\/rooms\/(\d+)\/availability$/);
  if (availMatch && req.method === 'GET') {
    const q = urlObj.searchParams;
    const available = isAvailable(availMatch[1], q.get('check_in'), q.get('check_out'));
    return json(res, 200, { available });
  }

  // ---- Admin CRUD ----
  if (urlPath === '/api/rooms' && req.method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const b = await parseBody(req);
    if (!b.title || !b.city || !b.price_per_night) return json(res, 400, { error: 'Titre, ville et prix requis.' });
    const info = db.prepare(`
      INSERT INTO rooms (title, type, description, city, country, address, latitude, longitude, price_per_night,
        capacity_adults, capacity_children, bedrooms, beds, bathrooms, amenities, images, status, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      b.title, b.type || 'chambre', b.description || '', b.city, b.country || 'France', b.address || '',
      b.latitude != null ? Number(b.latitude) : null, b.longitude != null ? Number(b.longitude) : null,
      Number(b.price_per_night), Number(b.capacity_adults || 2), Number(b.capacity_children || 0),
      Number(b.bedrooms || 1), Number(b.beds || 1), Number(b.bathrooms || 1),
      JSON.stringify(b.amenities || []), JSON.stringify(b.images || []),
      b.status || 'disponible', b.featured ? 1 : 0
    );
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(info.lastInsertRowid);
    return json(res, 201, { room: parseRoom(room) });
  }

  const editMatch = urlPath.match(/^\/api\/rooms\/(\d+)$/);
  if (editMatch && req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(editMatch[1]);
    if (!room) return notFound(res);
    const b = await parseBody(req);
    db.prepare(`
      UPDATE rooms SET title=?, type=?, description=?, city=?, country=?, address=?, latitude=?, longitude=?, price_per_night=?,
        capacity_adults=?, capacity_children=?, bedrooms=?, beds=?, bathrooms=?,
        amenities=?, images=?, status=?, featured=?, updated_at=datetime('now')
      WHERE id = ?
    `).run(
      b.title ?? room.title, b.type ?? room.type, b.description ?? room.description,
      b.city ?? room.city, b.country ?? room.country, b.address ?? room.address,
      b.latitude != null ? Number(b.latitude) : room.latitude,
      b.longitude != null ? Number(b.longitude) : room.longitude,
      b.price_per_night != null ? Number(b.price_per_night) : room.price_per_night,
      b.capacity_adults != null ? Number(b.capacity_adults) : room.capacity_adults,
      b.capacity_children != null ? Number(b.capacity_children) : room.capacity_children,
      b.bedrooms != null ? Number(b.bedrooms) : room.bedrooms,
      b.beds != null ? Number(b.beds) : room.beds,
      b.bathrooms != null ? Number(b.bathrooms) : room.bathrooms,
      b.amenities ? JSON.stringify(b.amenities) : room.amenities,
      b.images ? JSON.stringify(b.images) : room.images,
      b.status ?? room.status, b.featured != null ? (b.featured ? 1 : 0) : room.featured,
      editMatch[1]
    );
    const updated = db.prepare('SELECT * FROM rooms WHERE id = ?').get(editMatch[1]);
    return json(res, 200, { room: parseRoom(updated) });
  }

  if (editMatch && req.method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(editMatch[1]);
    if (!room) return notFound(res);
    const activeBooking = db.prepare(`SELECT id FROM bookings WHERE room_id = ? AND status IN ('en_attente','confirmee')`).get(editMatch[1]);
    if (activeBooking) return json(res, 409, { error: 'Impossible de supprimer : ce logement a des réservations actives.' });
    db.prepare('DELETE FROM rooms WHERE id = ?').run(editMatch[1]);
    return json(res, 200, { success: true });
  }

  // GET /api/admin/rooms — liste complète (y compris indisponibles) pour l'admin
  if (urlPath === '/api/admin/rooms' && req.method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY created_at DESC').all().map(parseRoom);
    return json(res, 200, { rooms });
  }

  return null;
}
