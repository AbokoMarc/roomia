import crypto from 'node:crypto';
import { db } from '../db.js';
import { json, parseBody, notFound } from '../lib/http.js';
import { requireAdmin, verifyPassword, hashPassword } from '../lib/auth.js';
import { notifyClient } from '../lib/notify.js';

// Génère un mot de passe temporaire lisible (évite les caractères ambigus 0/O/1/l)
function generateTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[crypto.randomInt(chars.length)];
  return out;
}

function requireAdminReauth(req, res, admin, providedPassword) {
  const adminRow = db.prepare('SELECT * FROM users WHERE id = ?').get(admin.id);
  if (!providedPassword || !verifyPassword(providedPassword, adminRow.password_hash)) {
    json(res, 401, { error: 'Mot de passe administrateur incorrect. Action refusée.' });
    return false;
  }
  return true;
}

export async function handleAdminUsers(req, res, urlPath) {
  // Liste basique (non sensible) déjà exposée par routes/admin.js -> GET /api/admin/users

  // POST /api/admin/users/:id/sensitive — voir les infos sensibles d'un client (re-authentification requise)
  const sensitiveMatch = urlPath.match(/^\/api\/admin\/users\/(\d+)\/sensitive$/);
  if (sensitiveMatch && req.method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { admin_password } = await parseBody(req);
    if (!requireAdminReauth(req, res, admin, admin_password)) return;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(sensitiveMatch[1]);
    if (!user) return notFound(res);
    const bookingsCount = db.prepare('SELECT COUNT(*) c FROM bookings WHERE user_id = ?').get(user.id).c;

    // Journal d'accès : on trace qui a consulté les données sensibles de qui, et quand.
    db.prepare('INSERT INTO sensitive_access_log (admin_id, viewed_user_id) VALUES (?, ?)').run(admin.id, user.id);

    return json(res, 200, {
      user: {
        id: user.id, name: user.name, email: user.email, phone: user.phone,
        country: user.country, address: user.address, city: user.city, postal_code: user.postal_code,
        date_of_birth: user.date_of_birth, nationality: user.nationality,
        id_document_type: user.id_document_type, id_document_number: user.id_document_number,
        default_travel_purpose: user.default_travel_purpose, preferred_language: user.preferred_language,
        role: user.role, loyalty_points: user.loyalty_points,
        created_at: user.created_at, bookings_count: bookingsCount,
      },
    });
    // Note : le mot de passe n'est JAMAIS renvoyé, même ici — il est haché de façon irréversible, par conception.
  }

  // PUT /api/admin/change-password — l'admin change son propre mot de passe (nécessite l'ancien)
  if (urlPath === '/api/admin/change-password' && req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { current_password, new_password } = await parseBody(req);
    if (!current_password || !new_password) return json(res, 400, { error: 'Mot de passe actuel et nouveau requis.' });
    if (new_password.length < 8) return json(res, 400, { error: 'Le mot de passe admin doit contenir au moins 8 caractères.' });
    const adminRow = db.prepare('SELECT * FROM users WHERE id = ?').get(admin.id);
    if (!verifyPassword(current_password, adminRow.password_hash)) return json(res, 401, { error: 'Mot de passe actuel incorrect.' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), admin.id);
    return json(res, 200, { success: true });
  }

  // POST /api/admin/users/:id/reset-password — génère un nouveau mot de passe temporaire (re-authentification requise)
  const resetMatch = urlPath.match(/^\/api\/admin\/users\/(\d+)\/reset-password$/);
  if (resetMatch && req.method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { admin_password } = await parseBody(req);
    if (!requireAdminReauth(req, res, admin, admin_password)) return;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(resetMatch[1]);
    if (!user) return notFound(res);

    const tempPassword = generateTempPassword();
    db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?`).run(hashPassword(tempPassword), user.id);
    db.prepare(`INSERT INTO password_reset_log (target_user_id, performed_by_admin_id) VALUES (?, ?)`).run(user.id, admin.id);

    notifyClient(user.id, 'mot_de_passe_reinitialise', 'Mot de passe réinitialisé', 'Un administrateur a réinitialisé votre mot de passe. Utilisez le nouveau mot de passe qui vous a été communiqué, vous devrez le changer à la connexion.', {});

    // Le mot de passe temporaire n'est affiché qu'une seule fois, à l'admin qui vient de le générer — à transmettre au client de vive voix / par un canal sécurisé.
    return json(res, 200, { temp_password: tempPassword, email: user.email, name: user.name });
  }

  return null;
}
