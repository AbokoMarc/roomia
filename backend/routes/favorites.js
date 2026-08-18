import { db } from '../db.js';
import { json, parseBody } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';

export async function handleFavorites(req, res, urlPath) {
  if (urlPath === '/api/favorites' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    const rooms = db.prepare(`
      SELECT rooms.* FROM favorites JOIN rooms ON rooms.id = favorites.room_id
      WHERE favorites.user_id = ? ORDER BY favorites.created_at DESC
    `).all(user.id).map(r => ({ ...r, images: JSON.parse(r.images || '[]'), amenities: JSON.parse(r.amenities || '[]') }));
    return json(res, 200, { rooms });
  }

  if (urlPath === '/api/favorites' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const { room_id } = await parseBody(req);
    if (!room_id) return json(res, 400, { error: 'Logement requis.' });
    db.prepare('INSERT OR IGNORE INTO favorites (user_id, room_id) VALUES (?, ?)').run(user.id, room_id);
    return json(res, 201, { success: true });
  }

  const delMatch = urlPath.match(/^\/api\/favorites\/(\d+)$/);
  if (delMatch && req.method === 'DELETE') {
    const user = requireAuth(req, res);
    if (!user) return;
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND room_id = ?').run(user.id, delMatch[1]);
    return json(res, 200, { success: true });
  }

  return null;
}
