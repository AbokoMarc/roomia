import { db } from '../db.js';
import { json } from '../lib/http.js';
import { getAuthUser } from '../lib/auth.js';
import { sseHandler } from '../lib/sse.js';

export async function handleNotifications(req, res, urlPath, urlObj) {
  // GET /api/notifications/stream?token=... — flux temps réel (EventSource ne permet pas les headers custom)
  if (urlPath === '/api/notifications/stream' && req.method === 'GET') {
    const token = urlObj.searchParams.get('token');
    const fakeReq = { headers: { authorization: `Bearer ${token}` } };
    const user = getAuthUser(fakeReq);
    if (!user) { res.writeHead(401); return res.end(); }
    return sseHandler(req, res, user);
  }

  if (urlPath === '/api/notifications' && req.method === 'GET') {
    const user = getAuthUser(req);
    if (!user) return json(res, 401, { error: 'Non authentifié.' });
    const rows = user.role === 'admin'
      ? await db.prepare('SELECT * FROM notifications WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 50').all()
      : await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(user.id);
    return json(res, 200, { notifications: rows.map(n => ({ ...n, data: JSON.parse(n.data || '{}') })) });
  }

  const readMatch = urlPath.match(/^\/api\/notifications\/(\d+)\/read$/);
  if (readMatch && req.method === 'PUT') {
    const user = getAuthUser(req);
    if (!user) return json(res, 401, { error: 'Non authentifié.' });
    await db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(readMatch[1]);
    return json(res, 200, { success: true });
  }

  if (urlPath === '/api/notifications/read-all' && req.method === 'PUT') {
    const user = getAuthUser(req);
    if (!user) return json(res, 401, { error: 'Non authentifié.' });
    if (user.role === 'admin') await db.prepare('UPDATE notifications SET read = 1 WHERE user_id IS NULL').run();
    else await db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(user.id);
    return json(res, 200, { success: true });
  }

  return null;
}
